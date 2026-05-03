@description('Environment name (e.g., dev, prod)')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

var token = uniqueString(resourceGroup().id, environmentName)
var storageName = toLower('rsm${environmentName}${take(token, 8)}')
var swaName = 'swa-resumee-${environmentName}-${take(token, 6)}'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/cv-uploads'
  properties: { publicAccess: 'None' }
}

resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  name: '${storage.name}/default'
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-30-days'
          enabled: true
          type: 'Lifecycle'
          definition: {
            actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: 30 } } }
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['cv-uploads/'] }
          }
        }
      ]
    }
  }
}

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: { name: 'Free', tier: 'Free' }
  tags: {
    'azd-service-name': 'web'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      apiLocation: 'api'
      outputLocation: ''
    }
  }
}

resource swaSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    BLOB_CONTAINER: 'cv-uploads'
  }
}

output staticWebAppName string = swa.name
output staticWebAppHostname string = swa.properties.defaultHostname
output storageAccountName string = storage.name

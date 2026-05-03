import json
from datetime import datetime, timedelta, timezone

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)


class BlobClient:
    def __init__(self, connection_string: str, container: str) -> None:
        self._service = BlobServiceClient.from_connection_string(connection_string)
        self._connection_string = connection_string
        self._container = container

    def ensure_container(self) -> None:
        client = self._service.get_container_client(self._container)
        if not client.exists():
            client.create_container()

    def write_json(self, path: str, payload: dict) -> str:
        data = json.dumps(payload).encode("utf-8")
        blob = self._service.get_blob_client(self._container, path)
        blob.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type="application/json"),
        )
        return path

    def read_json(self, path: str) -> dict:
        blob = self._service.get_blob_client(self._container, path)
        try:
            stream = blob.download_blob()
        except ResourceNotFoundError as exc:
            raise FileNotFoundError(path) from exc
        return json.loads(stream.readall())

    def write_image(self, path: str, data: bytes, content_type: str) -> str:
        blob = self._service.get_blob_client(self._container, path)
        blob.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        return path

    def generate_read_sas(self, path: str, minutes: int = 10) -> str:
        account = self._service.account_name
        key = self._service.credential.account_key
        expiry = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        token = generate_blob_sas(
            account_name=account,
            container_name=self._container,
            blob_name=path,
            account_key=key,
            permission=BlobSasPermissions(read=True),
            expiry=expiry,
        )
        return f"{self._service.url}{self._container}/{path}?{token}"

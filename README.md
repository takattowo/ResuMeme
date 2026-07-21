# ResuMeme

Live on: https://black-desert-031be090f.7.azurestaticapps.net/

A small project for learning the Azure stack end-to-end: Static Web Apps, managed Functions, Blob Storage, and Azure OpenAI. The app parses an uploaded CV (PDF or DOCX), then uses mode-specific AI generation to build a source-grounded Modern or Professional portfolio or the original satirical Chaos result. Each approach selects a deterministic visual variant from its own theme and layout pool. It deploys via `azd` to a Free-tier SWA + Standard LRS storage account.

## Stack

- **Frontend:** vanilla HTML/CSS/JS on Azure Static Web Apps
- **Backend:** Python 3.11 Azure Functions (managed by SWA, Python v2 programming model)
- **Storage:** Azure Blob Storage with a 30-day lifecycle policy
- **AI:** Azure OpenAI with factual Modern/Professional prompts and a satirical Chaos prompt
- **IaC:** Bicep, deployed with the Azure Developer CLI (`azd`)

## Local development

Prereqs: Python 3.11, Node 20+, Azure Functions Core Tools v4, Static Web Apps CLI, Azurite.

```bash
# Install global tools (one time)
npm i -g azure-functions-core-tools@4 --unsafe-perm true
npm i -g @azure/static-web-apps-cli azurite

# Set up backend
cd api
python -m venv .venv
.venv\Scripts\activate     # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt

# Generate test fixtures (one time)
python tests/fixtures/generate_fixtures.py
cd ..
```

Run the full stack locally, three terminals from the repo root:

```bash
# Terminal 1: Storage emulator
azurite --silent --skipApiVersionCheck

# Terminal 2: Functions
cd api && func start

# Terminal 3: SWA proxy on :4280
swa start frontend --api-location api
```

Open `http://localhost:4280`.

## Tests

```bash
cd api
$env:PYTHONPATH = "$PWD"   # PowerShell; bash: export PYTHONPATH=$PWD
.venv\Scripts\python.exe -m pytest tests/ -v

# Frontend presentation rules
cd ..
npm test
```

64 backend tests across 9 modules, including blob client and rate limiter integration with Azurite.

## Manual smoke test checklist

- [ ] Upload a PDF, renders the result at `/cv/<id>`
- [ ] Upload a DOCX, renders the result at `/cv/<id>`
- [ ] File selection opens the Modern / Professional / Chaos dialog
- [ ] Modern and Professional produce source-grounded AI content without chaos effects
- [ ] Fixed sample IDs cover all four seeded Modern and Professional variants
- [ ] Chaos generates satirical content and applies seeded effects
- [ ] Reload the result page, output is identical (deterministic per id)
- [ ] Copy the share link, opens correctly in incognito
- [ ] File over 5MB rejected with a friendly error
- [ ] Non-PDF/DOCX rejected with a friendly error
- [ ] Invalid id (`/cv/zzzzzzzz`) shows the 404 page
- [ ] Two uploads from the same IP within 30 seconds, second one returns 429
- [ ] `/careers` and `/legal` resolve correctly

## Deployment

```bash
azd auth login
azd up                    # first time
azd deploy                # subsequent code-only deploys
```

Run `azd provision` after changes under `infra/`; `azd deploy` only updates app code.

Set the four AI environment variables on the deployed SWA via the portal (Static Web App, Environment variables). All three presentation modes use them:

| Name | Example value |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | `https://<your-resource>.cognitiveservices.azure.com/` |
| `AZURE_OPENAI_KEY` | (paste the key) |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini` (or whatever deployment name you created) |
| `AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` |

The SWA also expects a deployment token in the GitHub repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` so the GitHub Actions workflow can auto-deploy on `main` pushes. Get the token from the portal under "Manage deployment token" and add it under Settings → Secrets and variables → Actions.

## Project structure

```
frontend/                       Static site (HTML/CSS/JS, no build step)
  staticwebapp.config.json      SWA routes and platform config
  index.html / cv.html / ...    Pages
  js/                           Vanilla JS
  css/                          Stylesheets
api/                            Azure Functions (Python v2 model)
  function_app.py               Routes: /upload, /cv/{id}, /health
  shared/                       Parsers, blob client, rate limiter, LLM client
  tests/                        pytest suite
infra/                          Bicep templates
azure.yaml                      azd project config
.github/workflows/              GitHub Actions deploy workflow
```

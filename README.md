# ResuMeme

> AI-powered CV enhancement that beats every ATS filter.
>
> *(Spoiler: it's a meme site that "enhances" your CV by re-rendering it as a chaotic visual disaster.)*

## Stack

- **Frontend:** vanilla HTML/CSS/JS on Azure Static Web Apps
- **Backend:** Python 3.11 Azure Functions (managed by SWA)
- **Storage:** Azure Blob Storage with a 30-day lifecycle policy

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

Run the full stack locally — three terminals (from repo root):

```bash
# Terminal 1: Storage emulator
# --skipApiVersionCheck is needed when the Azure SDK is newer than your installed Azurite
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
```

27 tests across 6 modules, including blob client integration with Azurite.

## Manual smoke test checklist

- [ ] Upload a PDF → renders chaos at `/cv/<id>`
- [ ] Upload a DOCX → renders chaos at `/cv/<id>`
- [ ] Reload result page → chaos is identical (deterministic seeded RNG)
- [ ] Copy share link → opens correctly in incognito with same chaos
- [ ] File >5MB rejected with friendly error
- [ ] Non-PDF/DOCX rejected with friendly error
- [ ] `/cv/zzzzzzzz` (invalid id) → friendly 404
- [ ] Download enhanced CV → `.html` file works offline with images intact
- [ ] Konami code (↑↑↓↓←→←→BA) → animations speed up, confetti, modem noise
- [ ] `prefers-reduced-motion: reduce` honored in OS settings

## Deployment

```bash
azd auth login
azd up                    # first time
azd deploy                # subsequent code-only deploys
```

After `azd up`, configure GitHub Actions deployment by adding the SWA deployment token from the portal as the `AZURE_STATIC_WEB_APPS_API_TOKEN` repo secret (Settings → Secrets and variables → Actions).

## Adding new chaos effects

1. Create `frontend/js/chaos/effects/<name>.js` exporting:

   ```js
   export default {
     name: 'myEffect',
     targets: 'word',          // 'page' | 'section' | 'word' | 'heading' | 'image'
     density: 0.1,             // fraction of matching targets to hit
     apply(el, rng, ctx) {
       el.classList.add('fx-my-effect');
     },
   };
   ```

2. Add an import + `EFFECTS.push(myEffect)` (or include it in the array literal) in `frontend/js/chaos/registry.js`.
3. Add any required CSS (keyframes, classes prefixed `.fx-`) to `frontend/css/chaos.css`.

That's it. No orchestrator changes needed.

## Design

See `docs/superpowers/specs/2026-05-03-cvenhancer-design.md` and the implementation plan at `docs/superpowers/plans/2026-05-03-cvenhancer.md`.

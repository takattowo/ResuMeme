# CVEnhancer

> *Sad because HR ignored your CV? We got you.*

A meme website that "enhances" your CV by re-rendering it as a chaotic visual disaster.

## Local development

```bash
# Backend (in api/)
cd api
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements-dev.txt

# Run all together using the SWA CLI (from repo root):
swa start frontend --api-location api
```

## Deployment

```bash
azd up
```

See `docs/superpowers/specs/2026-05-03-cvenhancer-design.md` for the design.

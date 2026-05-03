# CVEnhancer — Design Document

**Date:** 2026-05-03
**Status:** Draft, pending plan
**Tagline:** *"Sad because HR ignored your CV? We got you."*

## 1. Concept

CVEnhancer is a meme website. Users upload a PDF or DOCX of their CV; the
site parses it, then re-renders the content as a chaotic, intentionally
unprofessional visual disaster — clashing neon colors, strobing headings,
Comic Sans, rotating text, scattered emoji, achievement popups, and similar
nonsense. The result is hosted at a unique shareable URL.

The whole UI leans into the joke with fake-professional language
("AI-Powered Enhancement™", "Optimized for Recruiter Attention™") and
absurd loading messages.

## 2. Goals & Non-Goals

**Goals (v1)**
- Upload PDF/DOCX, parse text + embedded images
- Render chaotic result page at a unique shareable URL
- Deterministic chaos per link (same URL → same disaster on reload)
- Self-contained `.html` download of the rendered page
- Deploy on Azure (Static Web Apps + Functions + Blob)
- Architecture supports adding new chaos effects in <10 lines, single new file

**Non-Goals (v1)**
- User accounts / login (designed to be addable later — see §10)
- PDF or video output of the chaotic page
- Sample/fake-CV demo button (deferred)
- AI-generated avatars (we extract the avatar from the uploaded CV)
- Mobile-first design (works on mobile, but desktop is the primary target)
- Analytics, tracking, observability beyond default Azure logs
- Automated end-to-end tests
- Internationalization

## 3. Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Azure Static Web Apps  │         │    Azure Functions       │
│  (vanilla HTML/CSS/JS)  │ ──────▶ │  (Python, Consumption)   │
│                         │  POST   │                          │
│  - Landing page         │ /upload │  - Parse PDF (PyMuPDF)   │
│  - /cv/<id> viewer      │         │  - Parse DOCX            │
│                         │ ◀────── │  - Extract text+images   │
│                         │  {id}   │  - Save to Blob          │
│                         │         │  - Return short ID       │
└─────────────────────────┘         └────────────┬─────────────┘
            │                                    │
            │ GET /api/cv/<id>                   │
            │ fetches JSON + image SAS URLs      ▼
            │                            ┌──────────────────────┐
            └──────────────────────────▶ │  Azure Blob Storage  │
                                         │  cv-uploads/         │
                                         │    {id}.json         │
                                         │    {id}/img_0.jpg... │
                                         │  Lifecycle: 30d TTL  │
                                         └──────────────────────┘
```

**Stack choices:**
- **Frontend:** vanilla HTML/CSS/JS — no build step, simplest deploy, full
  control over CSS keyframes for chaos.
- **Backend:** Python on Azure Functions (Consumption plan). Python is
  chosen for PyMuPDF (`fitz`), the gold standard for PDF text + image
  extraction; `python-docx` + zip access handles DOCX.
- **Storage:** Azure Blob Storage with a lifecycle policy auto-deleting
  blobs >30 days old. The blob path is the record — no database.
- **Deployment:** Azure SWA + Functions (free/Consumption tiers). Estimated
  cost at low traffic: ~$0–2/month.

**Why Option 1 (client-rendered chaos) over Option 2 (server-rendered HTML):**
The backend stores parsed JSON; the chaos is generated in the browser via
a seeded PRNG keyed off the link ID. Smaller storage footprint, easier to
iterate on chaos effects without reprocessing CVs, and a natural fit for
the vanilla-JS frontend.

## 4. Data Flow

### Upload

```
1. User drags PDF/DOCX onto the landing page
2. Frontend POSTs multipart/form-data to /api/upload
3. Azure Function (upload):
   a. Validates content-type AND magic bytes (PDF: %PDF-, DOCX: PK\x03\x04)
   b. Validates size <= 5MB
   c. Generates 8-char URL-safe random ID (e.g., "Kx9mP2vQ")
   d. Parses file:
      - PDF:  PyMuPDF extracts page text + embedded images
      - DOCX: python-docx for text; unzip /word/media/* for images
      - Heuristic section split: look for "Experience", "Skills",
        "Education", "Summary" headings
      - On heuristic failure: dump raw_text only (chaos absorbs it)
   e. Writes {id}.json + {id}/img_0.jpg... to Blob
   f. Returns { id: "Kx9mP2vQ", url: "/cv/Kx9mP2vQ" }
4. Frontend redirects to /cv/Kx9mP2vQ
```

### View

```
1. User hits /cv/Kx9mP2vQ
2. SWA rewrites /cv/* → cv.html (configured in staticwebapp.config.json)
3. cv.html JS reads ID from window.location.pathname
4. Fetches /api/cv/<id> → returns JSON + SAS-signed image URLs
   (Function get_cv generates short-lived SAS URLs server-side)
5. Frontend seeds its PRNG (mulberry32) with hash(id)
6. Chaos orchestrator iterates registered effects, applies them
   to selected DOM targets. Same id → same chaos every time.
```

### JSON schema (`{id}.json`)

```json
{
  "id": "Kx9mP2vQ",
  "createdAt": "2026-05-03T14:22:00Z",
  "sections": {
    "name": "John Doe",
    "title": "Senior Developer",
    "contact": ["john@example.com", "+1-555-..."],
    "summary": "...",
    "experience": [
      { "role": "...", "company": "...", "dates": "...", "bullets": [] }
    ],
    "education": [],
    "skills": ["Python", "React"],
    "raw_text": "full extracted text as fallback"
  },
  "images": ["img_0.jpg", "img_1.jpg"],
  "ownerId": null
}
```

`ownerId` is reserved for the future login feature (§10). Always `null`
in v1.

## 5. UX

### Landing page (`/`)

```
┌─────────────────────────────────────────────────┐
│                  CVEnhancer™                    │
│   Sad because HR ignored your CV? We got you.   │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │     📄  Drop your CV here               │   │
│   │         (PDF or DOCX, max 5MB)          │   │
│   │     [or click to browse]                │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   ✨ AI-Powered Enhancement™                    │
│   ✨ Optimized for Recruiter Attention™         │
│   ✨ 100% ATS-Incompatible™                     │
│                                                 │
│  ⚠ Anyone with the link can see your enhanced   │
│    CV including any personal info on it.        │
└─────────────────────────────────────────────────┘
```

The landing page intentionally looks slightly-too-professional so the joke
lands harder when the user submits.

### Loading state

After upload, before redirect, cycle through fake messages (~600ms each):

- "Applying 47 layers of professionalism…"
- "Consulting recruiter psychology database…"
- "Maximizing buzzword density…"
- "Calibrating Comic Sans coefficient…"
- "Detecting passion for synergy…"
- "Aligning chakras with corporate values…"
- "Multiplying years of experience by 1.5…"
- "Checking if you went to Harvard… (you didn't)"
- "Retrofitting buzzwords…"
- "Leveraging leverage…"
- "Engaging recruiter dopamine receptors…"
- "Inserting strategic Comic Sans…"
- "Enhancement complete. Brace yourself."

### Result page (`/cv/<id>`)

The visual chaos. See §6 for the full effect catalog.

Bottom of page: two buttons:
- `[ ✨ Download Enhanced CV ✨ ]` — saves the rendered page as a
  self-contained `.html` (animations preserved). Images are inlined as
  base64 data URLs so the file works offline as a single artifact.
  Implemented via a Blob URL + anchor download in pure JS, no backend.
- `[ 📋 Copy share link ]` — copies the current URL to clipboard.

## 6. Chaos Effects

Chaos is driven by a **seeded PRNG (mulberry32)** keyed off the link ID, so
every visit to the same URL renders the same disaster.

### Effect catalog (v1 ships all of these)

**Text behavior**
- Zoom pulse: random words rapidly scale 0.5×↔2× at ~4Hz
- Typewriter: summary section types itself out on first load
- rAnDoM cApItAlIzAtIoN on random words
- `<mark>` highlight on random "important-looking" words
- Strikethrough on random words
- "[citation needed]" tags after the most impressive claims
- Glitch / chromatic aberration on `<h1>`/`<h2>`
- Rainbow gradient fill cycling on headings
- Wingdings flicker: random words flip to Wingdings for ~200ms then back
- Fake red squiggly spellcheck under buzzwords ("synergy", "leverage",
  "stakeholder")
- Random text rotation: ±8°
- Strobing heading colors at 4–6Hz
- Mixed font chaos: Comic Sans MS, Papyrus, Impact, Brush Script
  (system fonts where available; open-licensed look-alikes like Comic Neue
  bundled as fallback to avoid proprietary-font licensing issues)

**Layout chaos**
- `<marquee>`-style scrolling banner at top
- One random section rendered as a `<table>` with garish borders
- Diagonal watermark stamp ("VERIFIED ✓" / "URGENT" / "AS SEEN ON LINKEDIN")
- Cycling ugly background gradients on a 10s loop
- Skills section as chaotic word cloud (random font-size, rotation, color)

**Floating UI**
- Achievement popups every 4–7s (slide in bottom-right):
  - "🏆 Optimized synergy buzzwords (×3)"
  - "🎯 ATS bypass: Comic Sans deployed"
  - "✨ 47 leadership keywords detected"
  - "🚀 Quantified impact: ⭐⭐⭐⭐⭐"
  - "💼 Recruiter dopamine: MAXIMUM"
  - …(20+ in a pool)
- Fake real-time engagement widget:
  - `Recruiters viewing: 47 ↗`
  - `Buzzword saturation: 94%`
  - `Hire probability: 142%`
- Cookie banner that respawns when dismissed (3 dismissals max)
- Loading bar at top stuck at 87% forever
- Fake verification badges scattered: "✓ Verified by ChatGPT",
  "✓ Top 1% LinkedIn", "✓ FAANG-Adjacent™"
- Sparkle/star emoji scatter (~30 absolutely-positioned)

**Section-specific roasts**
- Skills with random ⭐ ratings (some 5★, some 1★, no logic)
- Years of experience inflated or replaced with "999+"
- Email/phone partly rendered in Wingdings
- Bullet markers randomly replaced with 🔥, 💯, ✨, 🚀
- "References available upon request" → "References: 🤷"

**Avatar (extracted from uploaded CV)**
- Headshot in corner, slowly rotating
- Bonus: 3–5 copies of the same headshot scattered at random
  positions/sizes/rotations
- Fallback when no image in CV: random emoji (🤡, 👽, 💀)

**Interaction**
- Custom cursor (Comic Sans pointer or sparkle trail)
- Click headshot → 360° backflip animation
- Hover any section → grows 150% and wobbles
- Konami code (`↑↑↓↓←→←→BA`) unlocks "MAX CHAOS MODE": doubles all
  animation speeds, fires confetti, plays a brief dial-up modem noise

### Extensibility — pluggable effect registry

**This is a hard requirement.** Adding a new dumb effect must be
addable in <10 lines of code in a single new file.

Each effect lives in `frontend/js/chaos/effects/<name>.js` and exports:

```js
export default {
  name: 'zoomPulse',
  targets: 'words',       // 'page' | 'section' | 'word' | 'image' | 'heading'
  density: 0.15,          // fraction of matching targets the effect should hit (0–1)
  apply(element, rng, ctx) {
    // mutate element, add CSS class, etc.
  }
};
```

`registry.js` imports all effect files and exposes the list. The
orchestrator runs every registered effect; for each, it queries DOM
targets matching `targets`, samples a subset using `density` and the
seeded RNG, and calls `apply()` on each. **Adding a new effect = create
one file + add one import line in `registry.js`.** No edits to the
orchestrator.

## 7. Validation & Error Handling

**File validation (frontend AND backend)**
- Accepted MIME types: `application/pdf`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max size: 5MB (rejected client-side, re-checked server-side)
- Server sniffs first bytes — don't trust filename or MIME alone
  (PDF: `%PDF-`, DOCX: `PK\x03\x04`)

**Error handling**

| Scenario | Behavior |
|---|---|
| Wrong file type | "We only accept PDF or DOCX. Did you try to upload a JPEG of a JPEG?" |
| File too big | "Your CV is too thicc. Max 5MB." |
| Parse failure (corrupted file) | Falls back to raw_text only — chaos still renders |
| Network/upload failure | Toast: "Enhancement failed. Recruiters definitely noticed. Try again." |
| `/cv/<bad-id>` not found | "This CV has been so enhanced it ascended to a higher plane. (Or it expired after 30 days.)" |
| Backend down | Static 500 page in the same chaotic style |

No retry logic, exponential backoff, or external error monitoring in v1.

## 8. Privacy

- Visible warning on the landing page: anyone with the link can see the
  enhanced CV including personal info
- 30-day TTL on all blobs via Azure lifecycle policy
- No analytics, tracking pixels, or PII logging on the backend
- SAS URLs for image downloads are short-lived (e.g., 10 min) so leaked
  links can't permanently expose extracted images

## 9. Repo Layout

```
CVEnhancer/
├─ frontend/                      # deployed to Static Web Apps
│  ├─ index.html                  # landing page
│  ├─ cv.html                     # /cv/<id> viewer
│  ├─ css/
│  │  ├─ landing.css
│  │  └─ chaos.css                # all keyframes + chaos classes
│  ├─ js/
│  │  ├─ upload.js                # drag-drop + POST to /api/upload
│  │  ├─ viewer.js                # fetches JSON, drives chaos
│  │  ├─ rng.js                   # mulberry32 seeded PRNG
│  │  └─ chaos/
│  │     ├─ registry.js           # imports + exports all effects
│  │     ├─ orchestrator.js       # picks effects, applies them
│  │     └─ effects/              # ⭐ add new dumb features here
│  │        ├─ zoomPulse.js
│  │        ├─ rotateText.js
│  │        ├─ wingdingsFlicker.js
│  │        ├─ achievementPopup.js
│  │        ├─ konamiMaxChaos.js
│  │        └─ ...
│  └─ assets/
│     └─ fonts/                   # open-licensed look-alikes (Comic Neue, etc.)
│
├─ api/                           # Azure Functions (Python v2 model)
│  ├─ function_app.py             # all routes via @app.route decorators
│  ├─ shared/
│  │  ├─ pdf_parser.py
│  │  ├─ docx_parser.py
│  │  ├─ blob_client.py
│  │  ├─ section_splitter.py
│  │  └─ id_gen.py
│  ├─ tests/
│  │  ├─ fixtures/                # synthetic CV PDFs and DOCXs
│  │  ├─ test_pdf_parser.py
│  │  ├─ test_docx_parser.py
│  │  ├─ test_section_splitter.py
│  │  └─ test_id_gen.py
│  ├─ requirements.txt
│  ├─ host.json
│  └─ local.settings.json         # (gitignored) local dev secrets
│
├─ infra/                         # Azure deployment
│  ├─ main.bicep                  # SWA + Function App + Storage
│  └─ azure.yaml                  # azd config
│
├─ docs/
│  └─ superpowers/specs/
│     └─ 2026-05-03-cvenhancer-design.md
│
├─ .github/workflows/
│  └─ azure-deploy.yml            # CI/CD to Azure
│
├─ staticwebapp.config.json       # SWA routes (rewrites /cv/* → cv.html)
├─ .gitignore
└─ README.md
```

## 10. Future Extensions (post-v1)

These are explicitly out of scope for v1 but the v1 design must not
foreclose them.

**User accounts / "My CVs" management**
- Azure Static Web Apps' built-in auth (GitHub/Microsoft/Google providers,
  zero backend code). `/.auth/me` returns the logged-in user.
- Set `owner_id` on blob metadata when an authenticated user uploads
  (the JSON schema already reserves the field).
- New "My CVs" page lists blobs filtered by `owner_id`.
- `DELETE /api/cv/<id>` Function checks `owner_id` matches before deleting.
- Optional later: a Cosmos DB index if blob-metadata listing gets slow.

**PDF / image / video output**
- Add a backend renderer using Playwright + headless Chromium to
  print-to-PDF or screenshot the result page.
- Move backend to App Service (or containerized Function) since
  Consumption Functions can't host Chromium.

**Sample / fake-CV demo button** on the landing page

**More chaos effects** — the registry pattern (§6) makes this trivial.

## 11. Testing

Light, deliberate. This is a meme site.

- **Backend:** unit tests for `pdf_parser` and `docx_parser` against ~5
  sample CVs in `api/tests/fixtures/`. Validates: text extracted, images
  extracted, doesn't crash on weird input.
- **Frontend:** manual smoke testing checklist in the README:
  - Upload PDF → renders chaos
  - Upload DOCX → renders chaos
  - Reload result page → identical chaos
  - Copy share link → opens correctly in incognito
  - File >5MB rejected with friendly error
  - Non-PDF/DOCX rejected with friendly error
  - Invalid `/cv/<id>` shows friendly 404
- **Integration:** no automated e2e tests in v1.

## 12. Open Items for Implementation Plan

These are deferred to the implementation plan, not this design:
- Exact Azure SKUs / Bicep parameter values
- CORS configuration between SWA and Functions (SWA's managed Functions
  integration eliminates CORS, so likely use that)
- `nanoid` vs `secrets.token_urlsafe(6)` for ID generation
- Specific list of fake achievement strings (just expand the catalog)
- Final list of "buzzwords" for spellcheck-squiggle effect

# CVEnhancer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a meme website that takes a user's PDF/DOCX CV, parses it, and re-renders it as visually chaotic content at a unique shareable URL — deployed on Azure (Static Web Apps + managed Python Functions + Blob Storage).

**Architecture:** Vanilla HTML/CSS/JS frontend on Azure Static Web Apps. Python 3.11 Azure Functions (v2 decorator model, managed by SWA) parses the upload and writes JSON + extracted images to Azure Blob Storage. Frontend fetches the JSON for a given link ID and renders deterministic chaos via a seeded PRNG plus a pluggable effect registry.

**Tech Stack:** Python 3.11, PyMuPDF (`fitz`), python-docx, azure-functions, azure-storage-blob, Azure Static Web Apps, Azure Blob Storage, vanilla HTML/CSS/JS, Bicep, GitHub Actions, pytest, reportlab (test fixtures only).

**Spec:** `docs/superpowers/specs/2026-05-03-cvenhancer-design.md`

---

## Local prerequisites (one-time setup, not a task)

The implementing engineer needs:
- Python 3.11
- Node.js 20+ (for the Static Web Apps CLI)
- Azure Functions Core Tools v4 (`npm i -g azure-functions-core-tools@4 --unsafe-perm true`)
- Azure Static Web Apps CLI (`npm i -g @azure/static-web-apps-cli`)
- Azure CLI (`az`) and Azure Developer CLI (`azd`) for deployment
- An Azure subscription

All DOM construction in this plan uses `document.createElement`, `textContent`, and `appendChild` — never `innerHTML` — to avoid XSS risk on user-supplied CV content.

---

## Phase 0 — Repo bootstrap

### Task 0.1: Initialize git, .gitignore, README

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Initialize git**

```bash
git init
git branch -M main
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.pytest_cache/

# Azure Functions
local.settings.json
bin/
obj/

# Node
node_modules/

# Azure Developer CLI
.azure/

# Azurite local storage
.azurite/

# IDEs
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Create `README.md`**

````markdown
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
````

- [ ] **Step 4: Initial commit**

```bash
git add .gitignore README.md docs/
git commit -m "chore: initial commit with spec and plan"
```

---

## Phase 1 — Backend project setup

### Task 1.1: Create Azure Functions Python v2 project structure

**Files:**
- Create: `api/requirements.txt`
- Create: `api/requirements-dev.txt`
- Create: `api/host.json`
- Create: `api/local.settings.json`
- Create: `api/function_app.py` (stub)
- Create: `api/shared/__init__.py`
- Create: `api/tests/__init__.py`
- Create: `api/tests/fixtures/__init__.py`

- [ ] **Step 1: Create `api/requirements.txt`**

```text
azure-functions
azure-storage-blob>=12.19.0
pymupdf>=1.24.0
python-docx>=1.1.0
```

- [ ] **Step 2: Create `api/requirements-dev.txt`**

```text
-r requirements.txt
pytest>=8.0
reportlab>=4.0
Pillow>=10.0
```

- [ ] **Step 3: Create `api/host.json`**

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

- [ ] **Step 4: Create `api/local.settings.json`** (gitignored)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER": "cv-uploads"
  }
}
```

- [ ] **Step 5: Create stub `api/function_app.py`**

```python
import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("ok", status_code=200)
```

- [ ] **Step 6: Create empty package init files**

```bash
type nul > api\shared\__init__.py
type nul > api\tests\__init__.py
type nul > api\tests\fixtures\__init__.py
```

(macOS/Linux: `touch api/shared/__init__.py api/tests/__init__.py api/tests/fixtures/__init__.py`)

- [ ] **Step 7: Set up venv and install deps**

```bash
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
```

- [ ] **Step 8: Commit**

```bash
git add api/
git commit -m "chore(api): scaffold Python v2 Functions project"
```

---

## Phase 2 — Backend parsers (TDD)

These tasks use synthetic fixtures generated programmatically. We never commit real CVs.

### Task 2.1: Synthetic fixture generator

**Files:**
- Create: `api/tests/fixtures/generate_fixtures.py`
- Create: `api/tests/fixtures/sample_cv.pdf` (generated)
- Create: `api/tests/fixtures/sample_cv.docx` (generated)
- Create: `api/tests/fixtures/sample_cv_with_image.pdf` (generated)
- Create: `api/tests/fixtures/sample_cv_no_sections.pdf` (generated)

- [ ] **Step 1: Write the fixture generator**

`api/tests/fixtures/generate_fixtures.py`:

```python
"""Generates synthetic PDF and DOCX fixtures for parser tests.
Run once to regenerate; outputs are committed to the repo.
"""
import io
import os

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
from docx import Document
from docx.shared import Inches

HERE = os.path.dirname(os.path.abspath(__file__))

SAMPLE_TEXT = {
    "header": "Jane Doe",
    "title": "Senior Software Engineer",
    "summary_heading": "Summary",
    "summary": "Experienced engineer with 8 years of building synergy.",
    "experience_heading": "Experience",
    "experience": [
        "Acme Corp - Staff Engineer (2020-2024)",
        "Built scalable systems leveraging cutting-edge stakeholder alignment.",
        "Globex - Senior Engineer (2016-2020)",
        "Spearheaded paradigm shifts in vertical-agnostic frameworks.",
    ],
    "skills_heading": "Skills",
    "skills": "Python, JavaScript, TypeScript, Go, Rust, Kubernetes, Synergy",
    "education_heading": "Education",
    "education": "BSc Computer Science, State University, 2016",
}


def _make_red_square(size: int = 80) -> bytes:
    img = Image.new("RGB", (size, size), color=(220, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def write_pdf(path: str, with_image: bool = False, with_sections: bool = True) -> None:
    c = canvas.Canvas(path, pagesize=letter)
    width, height = letter
    y = height - 60

    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, y, SAMPLE_TEXT["header"])
    y -= 24
    c.setFont("Helvetica", 12)
    c.drawString(60, y, SAMPLE_TEXT["title"])
    y -= 36

    if with_image:
        img_bytes = _make_red_square()
        img = ImageReader(io.BytesIO(img_bytes))
        c.drawImage(img, 450, height - 140, width=80, height=80)

    if with_sections:
        for heading_key, body_key in [
            ("summary_heading", "summary"),
            ("experience_heading", "experience"),
            ("skills_heading", "skills"),
            ("education_heading", "education"),
        ]:
            c.setFont("Helvetica-Bold", 13)
            c.drawString(60, y, SAMPLE_TEXT[heading_key])
            y -= 18
            c.setFont("Helvetica", 11)
            body = SAMPLE_TEXT[body_key]
            if isinstance(body, list):
                for line in body:
                    c.drawString(60, y, line)
                    y -= 14
            else:
                c.drawString(60, y, body)
                y -= 14
            y -= 10
    else:
        c.setFont("Helvetica", 11)
        prose = (
            "I am a passionate engineer who loves to leverage synergy "
            "across diverse stakeholders to drive transformational outcomes."
        )
        c.drawString(60, y, prose)

    c.showPage()
    c.save()


def write_docx(path: str) -> None:
    doc = Document()
    doc.add_heading(SAMPLE_TEXT["header"], level=0)
    doc.add_paragraph(SAMPLE_TEXT["title"])

    for heading_key, body_key in [
        ("summary_heading", "summary"),
        ("experience_heading", "experience"),
        ("skills_heading", "skills"),
        ("education_heading", "education"),
    ]:
        doc.add_heading(SAMPLE_TEXT[heading_key], level=1)
        body = SAMPLE_TEXT[body_key]
        if isinstance(body, list):
            for line in body:
                doc.add_paragraph(line)
        else:
            doc.add_paragraph(body)

    img_path = os.path.join(HERE, "_temp_red.png")
    with open(img_path, "wb") as f:
        f.write(_make_red_square())
    doc.add_picture(img_path, width=Inches(1.0))
    os.remove(img_path)

    doc.save(path)


def main() -> None:
    write_pdf(os.path.join(HERE, "sample_cv.pdf"))
    write_pdf(os.path.join(HERE, "sample_cv_with_image.pdf"), with_image=True)
    write_pdf(
        os.path.join(HERE, "sample_cv_no_sections.pdf"),
        with_sections=False,
    )
    write_docx(os.path.join(HERE, "sample_cv.docx"))
    print("Fixtures generated.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate fixtures**

```bash
cd api
python tests/fixtures/generate_fixtures.py
```

Expected: `Fixtures generated.` and four files appear in `api/tests/fixtures/`.

- [ ] **Step 3: Commit**

```bash
git add api/tests/fixtures/
git commit -m "test(api): add synthetic CV fixtures and generator"
```

---

### Task 2.2: PDF text extraction (TDD)

**Files:**
- Create: `api/shared/pdf_parser.py`
- Create: `api/tests/test_pdf_parser.py`

- [ ] **Step 1: Write failing test for text extraction**

`api/tests/test_pdf_parser.py`:

```python
import os

import pytest

from shared.pdf_parser import extract_pdf

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def test_extract_pdf_returns_text():
    with open(os.path.join(FIXTURES, "sample_cv.pdf"), "rb") as f:
        data = f.read()
    result = extract_pdf(data)
    assert "Jane Doe" in result["raw_text"]
    assert "Senior Software Engineer" in result["raw_text"]
    assert "Experience" in result["raw_text"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api
pytest tests/test_pdf_parser.py::test_extract_pdf_returns_text -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'shared.pdf_parser'`.

- [ ] **Step 3: Write minimal implementation**

`api/shared/pdf_parser.py`:

```python
from typing import TypedDict

import fitz  # PyMuPDF


class ParsedDocument(TypedDict):
    raw_text: str
    images: list[bytes]


def extract_pdf(data: bytes) -> ParsedDocument:
    """Extract text and embedded images from a PDF byte stream."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages = [page.get_text("text") for page in doc]
        raw_text = "\n".join(pages)
        return {"raw_text": raw_text, "images": []}
    finally:
        doc.close()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_pdf_parser.py::test_extract_pdf_returns_text -v
```

Expected: PASS.

- [ ] **Step 5: Add a second test for invalid PDF**

Append to `tests/test_pdf_parser.py`:

```python
def test_extract_pdf_raises_on_invalid_data():
    with pytest.raises(Exception):
        extract_pdf(b"this is not a pdf")
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_pdf_parser.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add api/shared/pdf_parser.py api/tests/test_pdf_parser.py
git commit -m "feat(api): extract text from PDF uploads"
```

---

### Task 2.3: PDF image extraction (TDD)

**Files:**
- Modify: `api/shared/pdf_parser.py`
- Modify: `api/tests/test_pdf_parser.py`

- [ ] **Step 1: Write failing tests for image extraction**

Append to `api/tests/test_pdf_parser.py`:

```python
def test_extract_pdf_returns_embedded_images():
    with open(os.path.join(FIXTURES, "sample_cv_with_image.pdf"), "rb") as f:
        data = f.read()
    result = extract_pdf(data)
    assert len(result["images"]) >= 1
    assert len(result["images"][0]) > 100


def test_extract_pdf_with_no_images_returns_empty_list():
    with open(os.path.join(FIXTURES, "sample_cv.pdf"), "rb") as f:
        data = f.read()
    result = extract_pdf(data)
    assert result["images"] == []
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pytest tests/test_pdf_parser.py -v
```

Expected: 2 of 4 tests fail (image-related ones).

- [ ] **Step 3: Update implementation to extract images**

Replace `api/shared/pdf_parser.py`:

```python
from typing import TypedDict

import fitz  # PyMuPDF


class ParsedDocument(TypedDict):
    raw_text: str
    images: list[bytes]


def extract_pdf(data: bytes) -> ParsedDocument:
    """Extract text and embedded images from a PDF byte stream."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages_text = [page.get_text("text") for page in doc]
        raw_text = "\n".join(pages_text)
        images = _extract_images(doc)
        return {"raw_text": raw_text, "images": images}
    finally:
        doc.close()


def _extract_images(doc: "fitz.Document") -> list[bytes]:
    seen: set[int] = set()
    images: list[bytes] = []
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            if xref in seen:
                continue
            seen.add(xref)
            base = doc.extract_image(xref)
            if base and base.get("image"):
                images.append(base["image"])
    return images
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_pdf_parser.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/shared/pdf_parser.py api/tests/test_pdf_parser.py
git commit -m "feat(api): extract embedded images from PDFs"
```

---

### Task 2.4: DOCX parser (TDD)

**Files:**
- Create: `api/shared/docx_parser.py`
- Create: `api/tests/test_docx_parser.py`

- [ ] **Step 1: Write failing tests**

`api/tests/test_docx_parser.py`:

```python
import os

import pytest

from shared.docx_parser import extract_docx

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def test_extract_docx_returns_text():
    with open(os.path.join(FIXTURES, "sample_cv.docx"), "rb") as f:
        data = f.read()
    result = extract_docx(data)
    assert "Jane Doe" in result["raw_text"]
    assert "Senior Software Engineer" in result["raw_text"]
    assert "Experience" in result["raw_text"]


def test_extract_docx_returns_embedded_images():
    with open(os.path.join(FIXTURES, "sample_cv.docx"), "rb") as f:
        data = f.read()
    result = extract_docx(data)
    assert len(result["images"]) >= 1
    assert len(result["images"][0]) > 100


def test_extract_docx_raises_on_invalid_data():
    with pytest.raises(Exception):
        extract_docx(b"not a docx")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_docx_parser.py -v
```

Expected: ModuleNotFoundError.

- [ ] **Step 3: Implement parser**

`api/shared/docx_parser.py`:

```python
import io
import zipfile
from typing import TypedDict

from docx import Document


class ParsedDocument(TypedDict):
    raw_text: str
    images: list[bytes]


def extract_docx(data: bytes) -> ParsedDocument:
    """Extract text and embedded images from a DOCX byte stream."""
    text = _extract_text(data)
    images = _extract_images(data)
    return {"raw_text": text, "images": images}


def _extract_text(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text:
            parts.append(para.text)
    return "\n".join(parts)


def _extract_images(data: bytes) -> list[bytes]:
    images: list[bytes] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in zf.namelist():
            if name.startswith("word/media/"):
                images.append(zf.read(name))
    return images
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_docx_parser.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/shared/docx_parser.py api/tests/test_docx_parser.py
git commit -m "feat(api): parse DOCX uploads (text + embedded images)"
```

---

### Task 2.5: Section heuristic splitter (TDD)

**Files:**
- Create: `api/shared/section_splitter.py`
- Create: `api/tests/test_section_splitter.py`

- [ ] **Step 1: Write failing tests**

`api/tests/test_section_splitter.py`:

```python
from shared.section_splitter import split_sections


def test_split_sections_finds_known_headings():
    text = """\
Jane Doe
Senior Engineer

Summary
I do things with computers.

Experience
Acme - 2020-2024
Built stuff.

Skills
Python, JavaScript

Education
BSc, 2016
"""
    result = split_sections(text)
    assert "I do things with computers" in result["summary"]
    assert "Acme" in result["experience"]
    assert "Python" in result["skills"]
    assert "BSc" in result["education"]
    assert result["raw_text"] == text


def test_split_sections_handles_missing_headings():
    text = "Just a blob of text with no recognizable structure."
    result = split_sections(text)
    assert result["summary"] == ""
    assert result["experience"] == ""
    assert result["skills"] == ""
    assert result["education"] == ""
    assert result["raw_text"] == text


def test_split_sections_is_case_insensitive():
    text = "EXPERIENCE\nDid things\nSKILLS\nPython"
    result = split_sections(text)
    assert "Did things" in result["experience"]
    assert "Python" in result["skills"]


def test_split_sections_extracts_name_from_first_line():
    text = "Jane Doe\nSenior Engineer\n\nSummary\nstuff"
    result = split_sections(text)
    assert result["name"] == "Jane Doe"
    assert result["title"] == "Senior Engineer"
```

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_section_splitter.py -v
```

Expected: ModuleNotFoundError.

- [ ] **Step 3: Implement splitter**

`api/shared/section_splitter.py`:

```python
from typing import TypedDict

KNOWN_HEADINGS = {
    "summary": ["summary", "profile", "objective", "about"],
    "experience": ["experience", "employment", "work history", "professional experience"],
    "skills": ["skills", "technical skills", "competencies"],
    "education": ["education", "academic background", "qualifications"],
}


class Sections(TypedDict):
    name: str
    title: str
    summary: str
    experience: str
    skills: str
    education: str
    raw_text: str


def split_sections(text: str) -> Sections:
    """Heuristic split of plain CV text into common sections.

    Falls back to empty strings for sections it cannot identify;
    the chaos renderer absorbs imperfect parses.
    """
    lines = text.splitlines()
    name, title = _extract_name_and_title(lines)

    sections: dict[str, list[str]] = {k: [] for k in KNOWN_HEADINGS}
    current: str | None = None

    for line in lines:
        normalized = line.strip().lower().rstrip(":")
        matched = _match_heading(normalized)
        if matched:
            current = matched
            continue
        if current and line.strip():
            sections[current].append(line.strip())

    return {
        "name": name,
        "title": title,
        "summary": "\n".join(sections["summary"]),
        "experience": "\n".join(sections["experience"]),
        "skills": "\n".join(sections["skills"]),
        "education": "\n".join(sections["education"]),
        "raw_text": text,
    }


def _match_heading(line: str) -> str | None:
    if not line or len(line) > 40:
        return None
    for canonical, aliases in KNOWN_HEADINGS.items():
        if line in aliases:
            return canonical
    return None


def _extract_name_and_title(lines: list[str]) -> tuple[str, str]:
    non_empty = [ln.strip() for ln in lines if ln.strip()]
    if not non_empty:
        return "", ""
    name = non_empty[0]
    second = non_empty[1] if len(non_empty) > 1 else ""
    title = second if second and not _match_heading(second.lower()) else ""
    return name, title
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_section_splitter.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/shared/section_splitter.py api/tests/test_section_splitter.py
git commit -m "feat(api): heuristic section splitter for parsed CV text"
```

---

### Task 2.6: ID generator (TDD)

**Files:**
- Create: `api/shared/id_gen.py`
- Create: `api/tests/test_id_gen.py`

- [ ] **Step 1: Write failing tests**

`api/tests/test_id_gen.py`:

```python
import re

from shared.id_gen import generate_id


def test_generate_id_returns_url_safe_string():
    cv_id = generate_id()
    assert re.match(r"^[A-Za-z0-9_-]+$", cv_id)


def test_generate_id_is_at_least_8_chars():
    cv_id = generate_id()
    assert len(cv_id) >= 8


def test_generate_id_is_unique_across_calls():
    ids = {generate_id() for _ in range(1000)}
    assert len(ids) == 1000
```

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_id_gen.py -v
```

Expected: ModuleNotFoundError.

- [ ] **Step 3: Implement**

`api/shared/id_gen.py`:

```python
import secrets


def generate_id() -> str:
    # secrets.token_urlsafe(6) produces 8 chars from 6 random bytes,
    # using the base64url alphabet (A-Z, a-z, 0-9, _, -).
    return secrets.token_urlsafe(6)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_id_gen.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/shared/id_gen.py api/tests/test_id_gen.py
git commit -m "feat(api): URL-safe random ID generator"
```

---

## Phase 3 — Backend Functions

### Task 3.1: Blob storage client wrapper

**Files:**
- Create: `api/shared/blob_client.py`
- Create: `api/tests/test_blob_client.py`

We use Azurite (the local Azure Storage emulator) for local tests. The connection string `UseDevelopmentStorage=true` points at it. Run `azurite` in another terminal before invoking the tests.

- [ ] **Step 1: Write failing tests**

`api/tests/test_blob_client.py`:

```python
import pytest

from shared.blob_client import BlobClient

CONN = "UseDevelopmentStorage=true"
CONTAINER = "cv-uploads-test"


@pytest.fixture
def client() -> BlobClient:
    bc = BlobClient(connection_string=CONN, container=CONTAINER)
    bc.ensure_container()
    return bc


def test_write_and_read_json(client: BlobClient):
    payload = {"id": "abc12345", "hello": "world"}
    client.write_json("abc12345.json", payload)
    got = client.read_json("abc12345.json")
    assert got == payload


def test_write_image_returns_blob_path(client: BlobClient):
    path = client.write_image("abc12345/img_0", b"\x89PNG\r\n\x1a\nfake", "image/png")
    assert path == "abc12345/img_0"


def test_generate_read_sas_returns_url(client: BlobClient):
    client.write_image("abc12345/img_sas", b"data", "image/png")
    url = client.generate_read_sas("abc12345/img_sas", minutes=10)
    assert url.startswith("http")
    assert "sig=" in url


def test_read_json_missing_blob_raises(client: BlobClient):
    with pytest.raises(FileNotFoundError):
        client.read_json("does-not-exist.json")
```

- [ ] **Step 2: Implement the client**

`api/shared/blob_client.py`:

```python
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
```

- [ ] **Step 3: Start Azurite (in a separate terminal)**

```bash
azurite --silent --location ./.azurite --debug ./.azurite/debug.log
```

- [ ] **Step 4: Run tests**

```bash
cd api
pytest tests/test_blob_client.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/shared/blob_client.py api/tests/test_blob_client.py
git commit -m "feat(api): blob storage client with SAS URL generation"
```

---

### Task 3.2: `/api/upload` Function endpoint

**Files:**
- Modify: `api/function_app.py`

- [ ] **Step 1: Replace `function_app.py`**

```python
import json
import logging
import os
from datetime import datetime, timezone

import azure.functions as func

from shared.blob_client import BlobClient
from shared.docx_parser import extract_docx
from shared.id_gen import generate_id
from shared.pdf_parser import extract_pdf
from shared.section_splitter import split_sections

MAX_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
DOCX_MAGIC = b"PK\x03\x04"

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


def _blob_client() -> BlobClient:
    conn = os.environ["STORAGE_CONNECTION_STRING"]
    container = os.environ.get("BLOB_CONTAINER", "cv-uploads")
    bc = BlobClient(conn, container)
    bc.ensure_container()
    return bc


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("ok", status_code=200)


@app.route(route="upload", methods=["POST"])
def upload(req: func.HttpRequest) -> func.HttpResponse:
    return upload_impl(req)


def upload_impl(req: func.HttpRequest) -> func.HttpResponse:
    files = req.files
    if not files or "file" not in files:
        return _json_error(400, "no_file", "No file uploaded.")

    body = files["file"].read()

    if len(body) == 0:
        return _json_error(400, "empty_file", "File is empty.")
    if len(body) > MAX_BYTES:
        return _json_error(413, "too_large", "Your CV is too thicc. Max 5MB.")

    kind = _detect_kind(body)
    if kind is None:
        return _json_error(
            415,
            "unsupported_type",
            "We only accept PDF or DOCX. Did you try to upload a JPEG of a JPEG?",
        )

    try:
        parsed = extract_pdf(body) if kind == "pdf" else extract_docx(body)
    except Exception:
        logging.exception("parse failure; falling back to raw_text only")
        parsed = {"raw_text": "", "images": []}

    sections = split_sections(parsed["raw_text"])

    cv_id = generate_id()
    image_paths: list[str] = []
    bc = _blob_client()
    for idx, img_bytes in enumerate(parsed["images"]):
        path = f"{cv_id}/img_{idx}"
        bc.write_image(path, img_bytes, _content_type_for_image(img_bytes))
        image_paths.append(path)

    document = {
        "id": cv_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sections": sections,
        "images": image_paths,
        "ownerId": None,
    }
    bc.write_json(f"{cv_id}.json", document)

    return func.HttpResponse(
        body=json.dumps({"id": cv_id, "url": f"/cv/{cv_id}"}),
        status_code=200,
        mimetype="application/json",
    )


def _detect_kind(data: bytes) -> str | None:
    if data.startswith(PDF_MAGIC):
        return "pdf"
    if data.startswith(DOCX_MAGIC):
        return "docx"
    return None


def _content_type_for_image(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "application/octet-stream"


def _json_error(status: int, code: str, message: str) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps({"error": code, "message": message}),
        status_code=status,
        mimetype="application/json",
    )
```

The split between `upload` (decorator-bound) and `upload_impl` (plain function) makes the logic directly callable in tests without the Functions runtime. Same pattern is used in Task 3.3.

- [ ] **Step 2: Start the Function host locally**

In a terminal (with Azurite already running):

```bash
cd api
func start
```

Expected: server starts on `http://localhost:7071`. Look for `Functions: upload, health`.

- [ ] **Step 3: Smoke test the upload endpoint manually**

```bash
curl -i -X POST -F "file=@api/tests/fixtures/sample_cv.pdf" http://localhost:7071/api/upload
```

Expected: HTTP 200, JSON body with `{"id": "...", "url": "/cv/..."}`.

- [ ] **Step 4: Verify rejection of non-PDF/DOCX**

```bash
echo "not a pdf" > junk.txt
curl -i -X POST -F "file=@junk.txt" http://localhost:7071/api/upload
```

Expected: HTTP 415 with `{"error":"unsupported_type"}`.

- [ ] **Step 5: Commit**

```bash
git add api/function_app.py
git commit -m "feat(api): /upload endpoint parses CV and writes blob"
```

---

### Task 3.3: `/api/cv/<id>` GET endpoint

**Files:**
- Modify: `api/function_app.py`

- [ ] **Step 1: Add the route**

Append to `api/function_app.py` (above the `_detect_kind` helper):

```python
import re

ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{6,16}$")


@app.route(route="cv/{cv_id}", methods=["GET"])
def get_cv(req: func.HttpRequest) -> func.HttpResponse:
    return get_cv_impl(req)


def get_cv_impl(req: func.HttpRequest) -> func.HttpResponse:
    cv_id = req.route_params.get("cv_id") or ""
    if not ID_PATTERN.match(cv_id):
        return _json_error(400, "bad_id", "Invalid CV id.")

    bc = _blob_client()
    try:
        document = bc.read_json(f"{cv_id}.json")
    except FileNotFoundError:
        return _json_error(
            404,
            "not_found",
            "This CV has been so enhanced it ascended to a higher plane.",
        )

    image_urls: list[str] = []
    for path in document.get("images", []):
        image_urls.append(bc.generate_read_sas(path, minutes=10))
    document["imageUrls"] = image_urls

    return func.HttpResponse(
        body=json.dumps(document),
        status_code=200,
        mimetype="application/json",
    )
```

- [ ] **Step 2: Test it manually**

After uploading a CV (Task 3.2 step 3 returns an `id`), fetch it:

```bash
curl -i http://localhost:7071/api/cv/<id-from-upload>
```

Expected: HTTP 200, JSON with `id`, `sections`, `images`, `imageUrls`.

- [ ] **Step 3: Verify 404 for unknown id**

```bash
curl -i http://localhost:7071/api/cv/zzzzzzzz
```

Expected: HTTP 404 with `not_found`.

- [ ] **Step 4: Commit**

```bash
git add api/function_app.py
git commit -m "feat(api): /cv/<id> endpoint returns parsed CV with image SAS URLs"
```

---

### Task 3.4: Helper-function tests for `function_app`

**Files:**
- Create: `api/tests/test_function_app.py`

We avoid testing the full HTTP flow programmatically — `azure-functions`' multipart parsing inside a manually-constructed `HttpRequest` is fragile across SDK versions. Instead we test the pure helper functions and rely on the manual `curl` smoke tests in Tasks 3.2 and 3.3 (and Task 8.3 for end-to-end on deployed infrastructure).

- [ ] **Step 1: Write helper tests**

`api/tests/test_function_app.py`:

```python
from function_app import _content_type_for_image, _detect_kind, ID_PATTERN

PNG_MAGIC = b"\x89PNG\r\n\x1a\n" + b"...rest"
JPEG_MAGIC = b"\xff\xd8\xff" + b"...rest"
GIF_MAGIC = b"GIF89a..."
PDF_MAGIC = b"%PDF-1.4..."
DOCX_MAGIC = b"PK\x03\x04..."


def test_detect_kind_pdf():
    assert _detect_kind(PDF_MAGIC) == "pdf"


def test_detect_kind_docx():
    assert _detect_kind(DOCX_MAGIC) == "docx"


def test_detect_kind_unknown():
    assert _detect_kind(b"plain text") is None


def test_content_type_for_png():
    assert _content_type_for_image(PNG_MAGIC) == "image/png"


def test_content_type_for_jpeg():
    assert _content_type_for_image(JPEG_MAGIC) == "image/jpeg"


def test_content_type_for_gif():
    assert _content_type_for_image(GIF_MAGIC) == "image/gif"


def test_content_type_unknown():
    assert _content_type_for_image(b"unknown") == "application/octet-stream"


def test_id_pattern_accepts_valid():
    assert ID_PATTERN.match("Kx9mP2vQ")
    assert ID_PATTERN.match("abc-_def")


def test_id_pattern_rejects_invalid():
    assert ID_PATTERN.match("short") is None
    assert ID_PATTERN.match("waaaaaaaaaaaaaaaaaaay-too-long") is None
    assert ID_PATTERN.match("has spaces") is None
    assert ID_PATTERN.match("has/slash") is None
```

- [ ] **Step 2: Run tests**

```bash
cd api
pytest tests/test_function_app.py -v
```

Expected: 10 passed.

- [ ] **Step 3: Commit**

```bash
git add api/tests/test_function_app.py
git commit -m "test(api): unit tests for upload validation helpers"
```

---

## Phase 4 — Frontend landing page

### Task 4.1: SWA configuration

**Files:**
- Create: `staticwebapp.config.json`

- [ ] **Step 1: Create the SWA config**

`staticwebapp.config.json`:

```json
{
  "platform": {
    "apiRuntime": "python:3.11"
  },
  "routes": [
    { "route": "/cv/*", "rewrite": "/cv.html" }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/cv/*", "/css/*", "/js/*", "/assets/*", "*.{css,js,jpg,png,svg,ico,woff,woff2}"]
  },
  "responseOverrides": {
    "404": { "rewrite": "/404.html" }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add staticwebapp.config.json
git commit -m "chore: SWA config with python:3.11 runtime and /cv/* rewrite"
```

---

### Task 4.2: Landing page HTML

**Files:**
- Create: `frontend/index.html`

- [ ] **Step 1: Create the landing page**

`frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CVEnhancer — AI-Powered CV Optimization</title>
  <link rel="stylesheet" href="/css/landing.css">
</head>
<body>
  <main class="landing">
    <header>
      <h1>CVEnhancer<span class="tm">™</span></h1>
      <p class="tagline">Sad because HR ignored your CV? We got you.</p>
    </header>

    <section id="upload-zone" class="dropzone" aria-label="CV upload">
      <input type="file" id="file-input" accept=".pdf,.docx" hidden>
      <div class="dropzone-inner">
        <div class="dropzone-icon">📄</div>
        <p class="dropzone-prompt">Drop your CV here</p>
        <p class="dropzone-sub">PDF or DOCX, max 5MB</p>
        <button type="button" id="browse-btn">or click to browse</button>
      </div>
    </section>

    <section id="loading" hidden aria-live="polite">
      <div class="spinner"></div>
      <p id="loading-msg">Initializing enhancement…</p>
    </section>

    <section id="error" hidden role="alert"></section>

    <ul class="features">
      <li>✨ AI-Powered Enhancement™</li>
      <li>✨ Optimized for Recruiter Attention™</li>
      <li>✨ 100% ATS-Incompatible™</li>
    </ul>

    <p class="warning">
      ⚠ Anyone with the link can see your enhanced CV including any
      personal info on it.
    </p>
  </main>

  <script type="module" src="/js/upload.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat(frontend): landing page HTML structure"
```

---

### Task 4.3: Landing page CSS

**Files:**
- Create: `frontend/css/landing.css`

- [ ] **Step 1: Create the stylesheet**

`frontend/css/landing.css`:

```css
:root {
  --bg: #f7f7f8;
  --fg: #111;
  --accent: #2563eb;
  --error: #dc2626;
  --muted: #6b7280;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
}

.landing {
  max-width: 640px;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin: 0 0 0.5rem;
  letter-spacing: -0.02em;
}

.tm {
  font-size: 1rem;
  vertical-align: super;
  color: var(--muted);
}

.tagline {
  font-size: 1.125rem;
  color: var(--muted);
  margin: 0 0 3rem;
}

.dropzone {
  border: 2px dashed #c7c7c9;
  border-radius: 12px;
  padding: 3rem 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.dropzone.drag-over {
  border-color: var(--accent);
  background: #eff6ff;
}

.dropzone-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.dropzone-prompt {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.dropzone-sub {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0 0 1rem;
}

#browse-btn {
  background: var(--accent);
  color: white;
  border: 0;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

#loading {
  margin-top: 2rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--accent);
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

#error {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  background: #fef2f2;
  color: var(--error);
  border: 1px solid #fecaca;
}

.features {
  list-style: none;
  padding: 0;
  margin: 3rem 0 1.5rem;
  color: var(--muted);
  font-size: 0.875rem;
}

.features li { margin: 0.25rem 0; }

.warning {
  font-size: 0.8125rem;
  color: var(--muted);
  max-width: 480px;
  margin: 2rem auto 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/css/landing.css
git commit -m "feat(frontend): landing page styles"
```

---

### Task 4.4: Upload JS

**Files:**
- Create: `frontend/js/upload.js`

- [ ] **Step 1: Create the upload script**

`frontend/js/upload.js`:

```js
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const LOADING_MESSAGES = [
  'Applying 47 layers of professionalism…',
  'Consulting recruiter psychology database…',
  'Maximizing buzzword density…',
  'Calibrating Comic Sans coefficient…',
  'Detecting passion for synergy…',
  'Aligning chakras with corporate values…',
  'Multiplying years of experience by 1.5…',
  'Checking if you went to Harvard… (you didn\'t)',
  'Retrofitting buzzwords…',
  'Leveraging leverage…',
  'Engaging recruiter dopamine receptors…',
  'Inserting strategic Comic Sans…',
  'Enhancement complete. Brace yourself.',
];

const dropzone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loading-msg');
const errorEl = document.getElementById('error');

browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (e.target === browseBtn) return;
  fileInput.click();
});

['dragover', 'dragenter'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  })
);

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  loadingEl.hidden = true;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

async function handleFile(file) {
  clearError();

  if (file.size > MAX_BYTES) {
    showError('Your CV is too thicc. Max 5MB.');
    return;
  }
  const lowerName = file.name.toLowerCase();
  const isAccepted =
    ACCEPTED.includes(file.type) ||
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.docx');
  if (!isAccepted) {
    showError('We only accept PDF or DOCX. Did you try to upload a JPEG of a JPEG?');
    return;
  }

  dropzone.hidden = true;
  loadingEl.hidden = false;
  cycleLoadingMessages();

  const fd = new FormData();
  fd.append('file', file);

  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || 'Enhancement failed. Recruiters definitely noticed.');
    }
    const { url } = await resp.json();
    window.location.href = url;
  } catch (err) {
    dropzone.hidden = false;
    showError(err.message);
  }
}

function cycleLoadingMessages() {
  let i = 0;
  loadingMsg.textContent = LOADING_MESSAGES[0];
  const interval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    loadingMsg.textContent = LOADING_MESSAGES[i];
    if (loadingEl.hidden) clearInterval(interval);
  }, 600);
}
```

- [ ] **Step 2: Smoke test locally**

In separate terminals:

```bash
# Terminal 1: Azurite
azurite --silent

# Terminal 2: Functions
cd api && func start

# Terminal 3: SWA CLI (from repo root)
swa start frontend --api-location api
```

Open `http://localhost:4280`. Drop a PDF. Verify:
- Loading spinner appears with cycling messages
- Page redirects to `/cv/<id>` (will show "Summoning chaos…" until Phase 5 lands)
- Manually fetching `http://localhost:4280/api/cv/<id>` returns the JSON

- [ ] **Step 3: Commit**

```bash
git add frontend/js/upload.js
git commit -m "feat(frontend): drag-drop upload with loading state and redirect"
```

---

## Phase 5 — Frontend chaos engine

### Task 5.1: Seeded PRNG

**Files:**
- Create: `frontend/js/rng.js`

- [ ] **Step 1: Create the PRNG module**

`frontend/js/rng.js`:

```js
// mulberry32 — small deterministic PRNG.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// cyrb53-style hash — fold a string into a 32-bit seed.
export function hashSeed(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export function seededRng(seedString) {
  return mulberry32(hashSeed(seedString));
}

export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randFloat(rng, min, max) {
  return rng() * (max - min) + min;
}

export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

export function shuffle(rng, array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
```

- [ ] **Step 2: Smoke test in browser console**

Open `http://localhost:4280`, open DevTools console, paste:

```js
const { seededRng, randInt } = await import('/js/rng.js');
const rng = seededRng('Kx9mP2vQ');
console.log(randInt(rng, 1, 100));
const rng2 = seededRng('Kx9mP2vQ');
console.log(randInt(rng2, 1, 100));
```

Expected: identical numbers.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/rng.js
git commit -m "feat(frontend): seeded PRNG (mulberry32 + cyrb53 hash)"
```

---

### Task 5.2: Effect registry and orchestrator

**Files:**
- Create: `frontend/js/chaos/registry.js`
- Create: `frontend/js/chaos/orchestrator.js`

- [ ] **Step 1: Create registry stub**

`frontend/js/chaos/registry.js`:

```js
// To register a new chaos effect:
//   1. Create a file in ./effects/<name>.js with a default export
//      matching the EffectModule shape (see orchestrator.js).
//   2. Add an import below and append it to EFFECTS.
//
// Each effect runs once per page load. The orchestrator queries DOM
// targets matching effect.targets and applies effect.apply() to a
// random subset selected via effect.density.

export const EFFECTS = [];
```

- [ ] **Step 2: Create the orchestrator**

`frontend/js/chaos/orchestrator.js`:

```js
import { shuffle } from '../rng.js';
import { EFFECTS } from './registry.js';

const SELECTORS = {
  page: 'body',
  section: '[data-cv-section]',
  word: '[data-cv-word]',
  heading: '[data-cv-heading]',
  image: '[data-cv-avatar]',
};

export function applyChaos(rng, ctx) {
  for (const effect of EFFECTS) {
    try {
      const targets = collectTargets(effect.targets);
      const density = typeof effect.density === 'number' ? effect.density : 1;
      const sampled = sampleTargets(rng, targets, density);
      for (const el of sampled) {
        effect.apply(el, rng, ctx);
      }
    } catch (err) {
      console.error(`Effect "${effect.name}" failed:`, err);
    }
  }
}

function collectTargets(kind) {
  if (kind === 'page' || kind === 'body') {
    return [document.body];
  }
  const selector = SELECTORS[kind];
  if (!selector) return [];
  return Array.from(document.querySelectorAll(selector));
}

function sampleTargets(rng, targets, density) {
  if (density >= 1) return targets;
  if (density <= 0) return [];
  const shuffled = shuffle(rng, targets);
  const count = Math.max(1, Math.round(targets.length * density));
  return shuffled.slice(0, count);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/chaos/registry.js frontend/js/chaos/orchestrator.js
git commit -m "feat(frontend): chaos effect registry and orchestrator"
```

---

### Task 5.3: Viewer page (`cv.html`) and base renderer

**Files:**
- Create: `frontend/cv.html`
- Create: `frontend/js/viewer.js`
- Create: `frontend/css/chaos.css`

- [ ] **Step 1: Create `cv.html`**

`frontend/cv.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CVEnhancer — Enhanced CV</title>
  <link rel="stylesheet" href="/css/chaos.css">
</head>
<body>
  <div id="cv-root" aria-busy="true">
    <p class="loading">Summoning chaos…</p>
  </div>
  <script type="module" src="/js/viewer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `viewer.js`**

All DOM construction uses `document.createElement` and `textContent` so user-supplied CV content is never interpreted as HTML.

`frontend/js/viewer.js`:

```js
import { seededRng, pick } from './rng.js';
import { applyChaos } from './chaos/orchestrator.js';

const root = document.getElementById('cv-root');

const cvId = (window.location.pathname.match(/\/cv\/([^/]+)/) || [])[1];

if (!cvId) {
  showFatal('No CV id in URL.');
} else {
  load(cvId).catch((err) => showFatal(err.message));
}

async function load(id) {
  const resp = await fetch(`/api/cv/${id}`);
  if (resp.status === 404) {
    showFatal(
      'This CV has been so enhanced it ascended to a higher plane. (Or it expired after 30 days.)'
    );
    return;
  }
  if (!resp.ok) {
    showFatal('Backend down. Recruiters definitely noticed.');
    return;
  }
  const cv = await resp.json();
  renderBaseDom(cv);
  const rng = seededRng(id);
  const ctx = { cvId: id, rng, cv };
  applyChaos(rng, ctx);
  root.removeAttribute('aria-busy');
}

function showFatal(message) {
  root.replaceChildren();
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = message;
  root.appendChild(p);
}

function renderBaseDom(cv) {
  const sections = cv.sections || {};
  const hasStructured =
    sections.summary || sections.experience || sections.skills || sections.education;

  const avatarUrl = (cv.imageUrls || [])[0] || null;
  const avatarFallback = pick(seededRng(cv.id + ':emoji'), ['🤡', '👽', '💀', '🦄', '👻']);

  root.replaceChildren();

  const avatarEl = document.createElement(avatarUrl ? 'img' : 'div');
  avatarEl.dataset.cvAvatar = '1';
  avatarEl.classList.add('cv-avatar');
  if (avatarUrl) {
    avatarEl.src = avatarUrl;
    avatarEl.alt = '';
  } else {
    avatarEl.textContent = avatarFallback;
  }
  root.appendChild(avatarEl);

  const header = document.createElement('header');
  header.dataset.cvSection = 'header';
  if (sections.name) header.appendChild(makeHeading(sections.name, 'name'));
  if (sections.title) header.appendChild(makeText(sections.title, 'p'));
  root.appendChild(header);

  if (hasStructured) {
    appendSection('summary', sections.summary);
    appendSection('experience', sections.experience);
    appendSection('skills', sections.skills);
    appendSection('education', sections.education);
  } else {
    appendRawText(sections.raw_text || '');
  }

  appendActionBar();
}

function appendSection(name, body) {
  if (!body) return;
  const section = document.createElement('section');
  section.dataset.cvSection = name;
  section.appendChild(makeHeading(name.toUpperCase(), name));
  for (const line of body.split('\n')) {
    if (line.trim()) section.appendChild(makeText(line));
  }
  root.appendChild(section);
}

function appendRawText(text) {
  const section = document.createElement('section');
  section.dataset.cvSection = 'raw';
  for (const line of text.split('\n')) {
    if (line.trim()) section.appendChild(makeText(line));
  }
  root.appendChild(section);
}

function makeHeading(text, key) {
  const h = document.createElement('h2');
  h.dataset.cvHeading = key;
  h.appendChild(splitWords(text));
  return h;
}

function makeText(text, tag = 'p') {
  const el = document.createElement(tag);
  el.appendChild(splitWords(text));
  return el;
}

function splitWords(text) {
  const frag = document.createDocumentFragment();
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(part));
    } else if (part) {
      const span = document.createElement('span');
      span.dataset.cvWord = '1';
      span.textContent = part;
      frag.appendChild(span);
    }
  }
  return frag;
}

function appendActionBar() {
  const bar = document.createElement('div');
  bar.className = 'cv-actions';
  bar.dataset.cvSection = 'actions';

  const dl = document.createElement('button');
  dl.id = 'btn-download';
  dl.textContent = '✨ Download Enhanced CV ✨';
  bar.appendChild(dl);

  const sh = document.createElement('button');
  sh.id = 'btn-share';
  sh.textContent = '📋 Copy share link';
  bar.appendChild(sh);

  root.appendChild(bar);
}
```

- [ ] **Step 3: Create base `chaos.css`**

`frontend/css/chaos.css`:

```css
:root {
  --chaos-speed: 1;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Comic Sans MS', 'Comic Neue', cursive;
  padding: 2rem;
  min-height: 100vh;
  overflow-x: hidden;
}

#cv-root {
  position: relative;
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  font-size: 1.25rem;
  color: #555;
  font-family: system-ui, sans-serif;
}

[data-cv-section] {
  position: relative;
  margin-bottom: 1.5rem;
  padding: 1rem;
}

[data-cv-heading] {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

[data-cv-word] {
  display: inline-block;
}

.cv-avatar {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 50%;
  z-index: 100;
  font-size: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cv-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 3rem;
  padding: 2rem;
}

.cv-actions button {
  padding: 1rem 1.5rem;
  font-size: 1.125rem;
  font-family: inherit;
  cursor: pointer;
  border: 3px solid #000;
  border-radius: 8px;
  background: #ff6;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Smoke test**

Visit `http://localhost:4280/cv/<id>` (using an id from a prior upload). Verify the CV content is rendered (no chaos yet — that comes in Phase 6).

- [ ] **Step 5: Commit**

```bash
git add frontend/cv.html frontend/js/viewer.js frontend/css/chaos.css
git commit -m "feat(frontend): viewer renders CV into chaos-ready DOM"
```

---

## Phase 6 — Chaos effects (batched by category)

Each task adds multiple effects in a single batch, registers them, and verifies them with a manual browser smoke check. Commits happen per category so each is reversible.

### Task 6.1: Text-behavior effects

**Files:**
- Create: `frontend/js/chaos/effects/zoomPulse.js`
- Create: `frontend/js/chaos/effects/randomCaps.js`
- Create: `frontend/js/chaos/effects/markHighlight.js`
- Create: `frontend/js/chaos/effects/strikethrough.js`
- Create: `frontend/js/chaos/effects/citationNeeded.js`
- Create: `frontend/js/chaos/effects/glitch.js`
- Create: `frontend/js/chaos/effects/rainbowGradient.js`
- Create: `frontend/js/chaos/effects/wingdingsFlicker.js`
- Create: `frontend/js/chaos/effects/fakeSpellcheck.js`
- Create: `frontend/js/chaos/effects/randomRotation.js`
- Create: `frontend/js/chaos/effects/strobeHeading.js`
- Create: `frontend/js/chaos/effects/mixedFonts.js`
- Modify: `frontend/css/chaos.css` (add keyframes)
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append keyframes to `chaos.css`**

```css
@keyframes zoom-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.8); }
}
.fx-zoom-pulse { animation: zoom-pulse calc(0.25s / var(--chaos-speed)) ease-in-out infinite; }

.fx-mark { background: #ff0; padding: 0 0.1em; }
.fx-strike { text-decoration: line-through; text-decoration-thickness: 3px; }
.fx-citation::after { content: ' [citation needed]'; color: #c00; font-size: 0.85em; }

@keyframes glitch {
  0%, 100% { text-shadow: 2px 0 #f0f, -2px 0 #0ff; transform: translate(0); }
  25% { text-shadow: -2px 0 #f0f, 2px 0 #0ff; transform: translate(1px, -1px); }
  50% { text-shadow: 2px 1px #f0f, -2px -1px #0ff; transform: translate(-1px, 1px); }
}
.fx-glitch { animation: glitch calc(0.4s / var(--chaos-speed)) infinite; }

@keyframes rainbow {
  0% { color: #ff0000; } 16% { color: #ff7f00; } 33% { color: #ffff00; }
  50% { color: #00ff00; } 66% { color: #0000ff; } 83% { color: #4b0082; }
  100% { color: #ff0000; }
}
.fx-rainbow { animation: rainbow calc(2s / var(--chaos-speed)) linear infinite; }

.fx-wingdings { font-family: 'Wingdings', 'Segoe UI Symbol', sans-serif; }

.fx-spellcheck {
  text-decoration: underline wavy red;
  text-decoration-thickness: 2px;
}

@keyframes strobe-color {
  0% { color: #f00; } 25% { color: #0f0; }
  50% { color: #00f; } 75% { color: #f0f; }
  100% { color: #ff0; }
}
.fx-strobe { animation: strobe-color calc(0.2s / var(--chaos-speed)) steps(1) infinite; }

@media (prefers-reduced-motion: reduce) {
  .fx-zoom-pulse, .fx-glitch, .fx-rainbow, .fx-strobe { animation: none !important; }
}
```

- [ ] **Step 2: Implement each effect**

`frontend/js/chaos/effects/zoomPulse.js`:

```js
export default {
  name: 'zoomPulse',
  targets: 'word',
  density: 0.08,
  apply(el) { el.classList.add('fx-zoom-pulse'); },
};
```

`frontend/js/chaos/effects/randomCaps.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'randomCaps',
  targets: 'word',
  density: 0.20,
  apply(el, rng) {
    const text = el.textContent;
    let out = '';
    for (const ch of text) {
      out += randInt(rng, 0, 1) ? ch.toUpperCase() : ch.toLowerCase();
    }
    el.textContent = out;
  },
};
```

`frontend/js/chaos/effects/markHighlight.js`:

```js
export default {
  name: 'markHighlight',
  targets: 'word',
  density: 0.12,
  apply(el) { el.classList.add('fx-mark'); },
};
```

`frontend/js/chaos/effects/strikethrough.js`:

```js
export default {
  name: 'strikethrough',
  targets: 'word',
  density: 0.07,
  apply(el) { el.classList.add('fx-strike'); },
};
```

`frontend/js/chaos/effects/citationNeeded.js`:

```js
const TRIGGERS = ['leadership', 'synergy', 'leverage', 'stakeholder', 'innovative', 'transform', 'paradigm', 'spearheaded', 'visionary'];
export default {
  name: 'citationNeeded',
  targets: 'word',
  density: 1,
  apply(el) {
    const lower = el.textContent.toLowerCase();
    if (TRIGGERS.some((t) => lower.includes(t))) el.classList.add('fx-citation');
  },
};
```

`frontend/js/chaos/effects/glitch.js`:

```js
export default {
  name: 'glitch',
  targets: 'heading',
  density: 0.5,
  apply(el) { el.classList.add('fx-glitch'); },
};
```

`frontend/js/chaos/effects/rainbowGradient.js`:

```js
export default {
  name: 'rainbow',
  targets: 'heading',
  density: 0.4,
  apply(el) { el.classList.add('fx-rainbow'); },
};
```

`frontend/js/chaos/effects/wingdingsFlicker.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'wingdingsFlicker',
  targets: 'word',
  density: 0.04,
  apply(el, rng) {
    const intervalMs = randInt(rng, 2000, 8000);
    setInterval(() => {
      el.classList.add('fx-wingdings');
      setTimeout(() => el.classList.remove('fx-wingdings'), 200);
    }, intervalMs);
  },
};
```

`frontend/js/chaos/effects/fakeSpellcheck.js`:

```js
const BUZZWORDS = ['synergy', 'leverage', 'stakeholder', 'paradigm', 'holistic', 'pivot', 'bandwidth'];
export default {
  name: 'fakeSpellcheck',
  targets: 'word',
  density: 1,
  apply(el) {
    const lower = el.textContent.toLowerCase();
    if (BUZZWORDS.some((b) => lower.includes(b))) el.classList.add('fx-spellcheck');
  },
};
```

`frontend/js/chaos/effects/randomRotation.js`:

```js
import { randFloat } from '../../rng.js';
export default {
  name: 'randomRotation',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    el.style.transform = `rotate(${randFloat(rng, -8, 8)}deg)`;
  },
};
```

`frontend/js/chaos/effects/strobeHeading.js`:

```js
export default {
  name: 'strobeHeading',
  targets: 'heading',
  density: 0.5,
  apply(el) { el.classList.add('fx-strobe'); },
};
```

`frontend/js/chaos/effects/mixedFonts.js`:

```js
import { pick } from '../../rng.js';
const FONTS = [
  '"Comic Sans MS", "Comic Neue", cursive',
  '"Papyrus", "Hieroglyphic", fantasy',
  '"Impact", "Charcoal", sans-serif',
  '"Brush Script MT", cursive',
  'monospace',
];
export default {
  name: 'mixedFonts',
  targets: 'section',
  density: 1,
  apply(el, rng) { el.style.fontFamily = pick(rng, FONTS); },
};
```

- [ ] **Step 3: Register all effects**

Replace `frontend/js/chaos/registry.js`:

```js
import zoomPulse from './effects/zoomPulse.js';
import randomCaps from './effects/randomCaps.js';
import markHighlight from './effects/markHighlight.js';
import strikethrough from './effects/strikethrough.js';
import citationNeeded from './effects/citationNeeded.js';
import glitch from './effects/glitch.js';
import rainbow from './effects/rainbowGradient.js';
import wingdingsFlicker from './effects/wingdingsFlicker.js';
import fakeSpellcheck from './effects/fakeSpellcheck.js';
import randomRotation from './effects/randomRotation.js';
import strobeHeading from './effects/strobeHeading.js';
import mixedFonts from './effects/mixedFonts.js';

export const EFFECTS = [
  zoomPulse,
  randomCaps,
  markHighlight,
  strikethrough,
  citationNeeded,
  glitch,
  rainbow,
  wingdingsFlicker,
  fakeSpellcheck,
  randomRotation,
  strobeHeading,
  mixedFonts,
];
```

- [ ] **Step 4: Smoke test in browser**

Reload `/cv/<id>`. Verify:
- Words pulse, some are highlighted yellow, some struck through
- Headings glitch, some are rainbow, some strobe
- Buzzwords have red squiggle underlines
- Sections are rotated
- Wingdings characters briefly flicker every few seconds

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/effects/ frontend/js/chaos/registry.js frontend/css/chaos.css
git commit -m "feat(frontend): text-behavior chaos effects"
```

---

### Task 6.2: Layout chaos effects

**Files:**
- Create: `frontend/js/chaos/effects/marqueeBanner.js`
- Create: `frontend/js/chaos/effects/tableSection.js`
- Create: `frontend/js/chaos/effects/watermark.js`
- Create: `frontend/js/chaos/effects/cyclingBg.js`
- Create: `frontend/js/chaos/effects/wordCloud.js`
- Modify: `frontend/css/chaos.css`
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append CSS**

```css
@keyframes scroll-left {
  from { transform: translateX(100vw); }
  to { transform: translateX(-100%); }
}
.fx-marquee {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  background: #f0f;
  color: #ff0;
  font-weight: 900;
  font-size: 1.5rem;
  white-space: nowrap;
  padding: 0.5rem 0;
  z-index: 200;
  pointer-events: none;
}
.fx-marquee span {
  display: inline-block;
  animation: scroll-left 12s linear infinite;
}

.fx-table {
  border: 5px ridge #f0f !important;
  background: repeating-linear-gradient(45deg, #ff0, #ff0 10px, #f0f 10px, #f0f 20px);
}

.fx-watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 8rem;
  font-weight: 900;
  color: rgba(255, 0, 0, 0.15);
  pointer-events: none;
  z-index: 5;
  font-family: Impact, sans-serif;
  letter-spacing: 0.1em;
}

@keyframes ugly-bg {
  0% { background: linear-gradient(45deg, #f0f, #0ff); }
  20% { background: linear-gradient(45deg, #ff0, #f0f); }
  40% { background: linear-gradient(45deg, #0f0, #f00); }
  60% { background: linear-gradient(45deg, #00f, #ff0); }
  80% { background: linear-gradient(45deg, #f0f, #0f0); }
  100% { background: linear-gradient(45deg, #f0f, #0ff); }
}
.fx-cycling-bg { animation: ugly-bg calc(10s / var(--chaos-speed)) linear infinite; }

.fx-wordcloud { display: block; line-height: 1; }
.fx-wordcloud > span {
  display: inline-block;
  margin: 0.25rem;
  padding: 0.1em 0.3em;
}

@media (prefers-reduced-motion: reduce) {
  .fx-marquee span { animation: none; transform: translateX(0); }
  .fx-cycling-bg { animation: none; background: #fdd; }
}
```

- [ ] **Step 2: Implement effects**

`frontend/js/chaos/effects/marqueeBanner.js`:

```js
import { pick } from '../../rng.js';
const TEXTS = [
  '🔥 LIMITED TIME OFFER: HIRE THIS PERSON NOW 🔥',
  '⭐ TOP RATED ON LINKEDIN ⭐ 5/5 RECRUITERS AGREE ⭐',
  '🚨 ENHANCED CV ALERT: PROCEED WITH CAUTION 🚨',
];
export default {
  name: 'marqueeBanner',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const div = document.createElement('div');
    div.className = 'fx-marquee';
    const inner = document.createElement('span');
    inner.textContent = pick(rng, TEXTS);
    div.appendChild(inner);
    document.body.appendChild(div);
  },
};
```

`frontend/js/chaos/effects/tableSection.js`:

```js
export default {
  name: 'tableSection',
  targets: 'section',
  density: 0.15,
  apply(el) { el.classList.add('fx-table'); },
};
```

`frontend/js/chaos/effects/watermark.js`:

```js
import { pick } from '../../rng.js';
const STAMPS = ['VERIFIED ✓', 'URGENT', 'AS SEEN ON LINKEDIN', 'PROFESSIONAL', 'CERTIFIED'];
export default {
  name: 'watermark',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const div = document.createElement('div');
    div.className = 'fx-watermark';
    div.textContent = pick(rng, STAMPS);
    document.body.appendChild(div);
  },
};
```

`frontend/js/chaos/effects/cyclingBg.js`:

```js
export default {
  name: 'cyclingBg',
  targets: 'page',
  density: 1,
  apply() { document.body.classList.add('fx-cycling-bg'); },
};
```

`frontend/js/chaos/effects/wordCloud.js`:

```js
import { randInt, pick } from '../../rng.js';
const COLORS = ['#f0f', '#0ff', '#ff0', '#0f0', '#f00', '#00f', '#fa0'];
export default {
  name: 'wordCloud',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    el.classList.add('fx-wordcloud');
    for (const word of el.querySelectorAll('[data-cv-word]')) {
      word.style.fontSize = `${randInt(rng, 14, 60)}px`;
      word.style.transform = `rotate(${randInt(rng, -45, 45)}deg)`;
      word.style.color = pick(rng, COLORS);
    }
  },
};
```

- [ ] **Step 3: Register**

Append to `frontend/js/chaos/registry.js`:

```js
import marqueeBanner from './effects/marqueeBanner.js';
import tableSection from './effects/tableSection.js';
import watermark from './effects/watermark.js';
import cyclingBg from './effects/cyclingBg.js';
import wordCloud from './effects/wordCloud.js';

EFFECTS.push(marqueeBanner, tableSection, watermark, cyclingBg, wordCloud);
```

- [ ] **Step 4: Smoke test**

Reload `/cv/<id>`. Verify: scrolling banner, watermark stamp, cycling background, skills word cloud, one section has a clashing tablecloth-pattern background.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/effects/ frontend/js/chaos/registry.js frontend/css/chaos.css
git commit -m "feat(frontend): layout chaos effects"
```

---

### Task 6.3: Floating UI effects

**Files:**
- Create: `frontend/js/chaos/effects/achievementPopup.js`
- Create: `frontend/js/chaos/effects/engagementWidget.js`
- Create: `frontend/js/chaos/effects/cookieRespawn.js`
- Create: `frontend/js/chaos/effects/stuckLoadingBar.js`
- Create: `frontend/js/chaos/effects/fakeBadges.js`
- Create: `frontend/js/chaos/effects/sparkleScatter.js`
- Modify: `frontend/css/chaos.css`
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append CSS**

```css
.fx-popup {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: rgba(0,0,0,0.85);
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-family: system-ui, sans-serif;
  font-size: 0.95rem;
  z-index: 300;
  animation: popup-in 0.3s ease-out;
}
@keyframes popup-in {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.fx-engagement-widget {
  position: fixed;
  top: 4rem;
  left: 1rem;
  background: #000;
  color: #0f0;
  padding: 0.75rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  z-index: 200;
  border: 2px solid #0f0;
  min-width: 220px;
  white-space: pre;
}

.fx-cookie {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  background: #fff;
  border: 2px solid #000;
  padding: 1rem;
  max-width: 320px;
  z-index: 350;
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
}
.fx-cookie button {
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}

.fx-loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  width: 87%;
  background: linear-gradient(90deg, #f0f, #0ff);
  z-index: 250;
}

.fx-badge {
  position: absolute;
  background: #0a0;
  color: #fff;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  border-radius: 4px;
  font-weight: 700;
  pointer-events: none;
  z-index: 50;
}

.fx-sparkle {
  position: absolute;
  pointer-events: none;
  font-size: 1.5rem;
  z-index: 10;
}
```

- [ ] **Step 2: Implement effects**

All popups/badges/widgets use `createElement` + `textContent` so we never inject untrusted HTML.

`frontend/js/chaos/effects/achievementPopup.js`:

```js
import { pick, randInt } from '../../rng.js';
const POOL = [
  '🏆 Optimized synergy buzzwords (×3)',
  '🎯 ATS bypass: Comic Sans deployed',
  '✨ 47 leadership keywords detected',
  '🚀 Quantified impact: ⭐⭐⭐⭐⭐',
  '💼 Recruiter dopamine: MAXIMUM',
  '🎓 Harvard probability: NaN%',
  '🔥 Buzzword density: critical',
  '💎 Premium professional aura unlocked',
  '🦾 LinkedIn algorithm: pleased',
  '🧠 Big brain energy verified',
  '📈 Career trajectory: VERTICAL',
  '🎉 Promotion incoming (citation needed)',
  '⚡ Rizz coefficient: peak',
  '🛸 Recruiter abducted by enthusiasm',
  '🎩 Top hat tipped by 3 hiring managers',
  '🍔 Lunch meeting probability: 99%',
  '🦄 Unicorn employee status approved',
  '📊 Synergy graph: trending up',
  '🧙 Spellbook of buzzwords: complete',
  '🎪 Greatest CV on Earth™',
];

export default {
  name: 'achievementPopup',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const schedule = () => {
      const ms = randInt(rng, 4000, 7000);
      setTimeout(() => {
        const popup = document.createElement('div');
        popup.className = 'fx-popup';
        popup.textContent = pick(rng, POOL);
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 4000);
        schedule();
      }, ms);
    };
    schedule();
  },
};
```

`frontend/js/chaos/effects/engagementWidget.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'engagementWidget',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    const widget = document.createElement('div');
    widget.className = 'fx-engagement-widget';
    document.body.appendChild(widget);

    function tick() {
      const text = [
        `Recruiters viewing: ${randInt(rng, 30, 99)} ↗`,
        `Buzzword saturation: ${randInt(rng, 80, 99)}%`,
        `Hire probability: ${randInt(rng, 100, 200)}%`,
        `Synergy index: ${randInt(rng, 9000, 9999)}`,
      ].join('\n');
      widget.textContent = text;
    }
    tick();
    setInterval(tick, 1500);
  },
};
```

`frontend/js/chaos/effects/cookieRespawn.js`:

```js
export default {
  name: 'cookieRespawn',
  targets: 'page',
  density: 1,
  apply() {
    let dismissals = 0;
    const MAX = 3;
    function showCookie() {
      if (dismissals >= MAX) return;
      const div = document.createElement('div');
      div.className = 'fx-cookie';

      const title = document.createElement('strong');
      title.textContent = '🍪 We use cookies';
      div.appendChild(title);

      const body = document.createElement('p');
      body.textContent =
        'By using this site you agree to having your CV enhanced beyond recognition.';
      div.appendChild(body);

      const btn = document.createElement('button');
      btn.textContent = 'I Reluctantly Agree';
      btn.addEventListener('click', () => {
        div.remove();
        dismissals += 1;
        setTimeout(showCookie, 2000);
      });
      div.appendChild(btn);

      document.body.appendChild(div);
    }
    setTimeout(showCookie, 1500);
  },
};
```

`frontend/js/chaos/effects/stuckLoadingBar.js`:

```js
export default {
  name: 'stuckLoadingBar',
  targets: 'page',
  density: 1,
  apply() {
    const bar = document.createElement('div');
    bar.className = 'fx-loading-bar';
    document.body.appendChild(bar);
  },
};
```

`frontend/js/chaos/effects/fakeBadges.js`:

```js
import { randInt, pick } from '../../rng.js';
const BADGES = [
  '✓ Verified by ChatGPT',
  '✓ Top 1% LinkedIn',
  '✓ FAANG-Adjacent™',
  '✓ Recruiter Approved',
  '✓ ATS-Compatible*',
  '✓ Big Brain Certified',
];
export default {
  name: 'fakeBadges',
  targets: 'section',
  density: 0.4,
  apply(el, rng) {
    const badge = document.createElement('span');
    badge.className = 'fx-badge';
    badge.textContent = pick(rng, BADGES);
    badge.style.top = `${randInt(rng, -10, 5)}px`;
    badge.style.right = `${randInt(rng, -10, 30)}px`;
    if (!el.style.position) el.style.position = 'relative';
    el.appendChild(badge);
  },
};
```

`frontend/js/chaos/effects/sparkleScatter.js`:

```js
import { randInt, pick } from '../../rng.js';
const EMOJI = ['✨', '⭐', '💫', '🌟', '🎉', '💯'];
export default {
  name: 'sparkleScatter',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('span');
      s.className = 'fx-sparkle';
      s.textContent = pick(rng, EMOJI);
      s.style.top = `${randInt(rng, 0, 100)}vh`;
      s.style.left = `${randInt(rng, 0, 100)}vw`;
      s.style.transform = `rotate(${randInt(rng, 0, 360)}deg)`;
      document.body.appendChild(s);
    }
  },
};
```

- [ ] **Step 3: Register**

Append to `frontend/js/chaos/registry.js`:

```js
import achievementPopup from './effects/achievementPopup.js';
import engagementWidget from './effects/engagementWidget.js';
import cookieRespawn from './effects/cookieRespawn.js';
import stuckLoadingBar from './effects/stuckLoadingBar.js';
import fakeBadges from './effects/fakeBadges.js';
import sparkleScatter from './effects/sparkleScatter.js';

EFFECTS.push(achievementPopup, engagementWidget, cookieRespawn, stuckLoadingBar, fakeBadges, sparkleScatter);
```

- [ ] **Step 4: Smoke test**

Reload page. Verify: achievement popups every few seconds, fake metrics widget upper-left, cookie banner appears, loading bar at top, badges appear on sections, sparkles scattered everywhere.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/ frontend/css/chaos.css
git commit -m "feat(frontend): floating UI chaos effects"
```

---

### Task 6.4: Section-roast effects

**Files:**
- Create: `frontend/js/chaos/effects/skillsRatings.js`
- Create: `frontend/js/chaos/effects/inflatedYears.js`
- Create: `frontend/js/chaos/effects/wingdingsContact.js`
- Create: `frontend/js/chaos/effects/emojiBullets.js`
- Create: `frontend/js/chaos/effects/refsRoast.js`
- Modify: `frontend/css/chaos.css`
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append CSS**

```css
.fx-rating { font-size: 0.85em; margin-left: 0.4em; color: #ff8800; }
```

- [ ] **Step 2: Implement effects**

`frontend/js/chaos/effects/skillsRatings.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'skillsRatings',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (el.dataset.cvSection !== 'skills') return;
    for (const word of el.querySelectorAll('[data-cv-word]')) {
      const stars = randInt(rng, 1, 5);
      const span = document.createElement('span');
      span.className = 'fx-rating';
      span.textContent = '⭐'.repeat(stars);
      word.appendChild(span);
    }
  },
};
```

`frontend/js/chaos/effects/inflatedYears.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'inflatedYears',
  targets: 'word',
  density: 1,
  apply(el, rng) {
    const txt = el.textContent;
    const match = txt.match(/^(\d{1,2})$/);
    if (match && parseInt(match[1], 10) <= 50) {
      el.textContent = randInt(rng, 0, 1) ? '999+' : String(parseInt(match[1], 10) * randInt(rng, 2, 10));
    }
  },
};
```

`frontend/js/chaos/effects/wingdingsContact.js`:

```js
export default {
  name: 'wingdingsContact',
  targets: 'word',
  density: 1,
  apply(el) {
    const txt = el.textContent;
    if (!/@/.test(txt) && !/^\+?\d[\d\s\-()]{5,}$/.test(txt)) return;
    const chars = Array.from(txt);
    el.textContent = '';
    chars.forEach((c, i) => {
      if (i % 3 === 0) {
        const w = document.createElement('span');
        w.className = 'fx-wingdings';
        w.textContent = c;
        el.appendChild(w);
      } else {
        el.appendChild(document.createTextNode(c));
      }
    });
  },
};
```

`frontend/js/chaos/effects/emojiBullets.js`:

```js
import { pick } from '../../rng.js';
const BULLETS = ['🔥', '💯', '✨', '🚀'];
export default {
  name: 'emojiBullets',
  targets: 'section',
  density: 1,
  apply(el, rng) {
    if (!['experience', 'education'].includes(el.dataset.cvSection)) return;
    for (const p of el.querySelectorAll('p')) {
      const bullet = pick(rng, BULLETS);
      p.textContent = `${bullet} ${p.textContent}`;
    }
  },
};
```

`frontend/js/chaos/effects/refsRoast.js`:

```js
export default {
  name: 'refsRoast',
  targets: 'word',
  density: 1,
  apply(el) {
    const txt = el.textContent.toLowerCase();
    if (txt.includes('references')) {
      el.textContent = 'References: 🤷';
    }
  },
};
```

- [ ] **Step 3: Register**

Append to `registry.js`:

```js
import skillsRatings from './effects/skillsRatings.js';
import inflatedYears from './effects/inflatedYears.js';
import wingdingsContact from './effects/wingdingsContact.js';
import emojiBullets from './effects/emojiBullets.js';
import refsRoast from './effects/refsRoast.js';

EFFECTS.push(skillsRatings, inflatedYears, wingdingsContact, emojiBullets, refsRoast);
```

- [ ] **Step 4: Smoke test**

Reload `/cv/<id>`. Verify: skills have stars, contact info has wingdings characters mixed in, bullet points start with random emoji, "References" text replaced.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/ frontend/css/chaos.css
git commit -m "feat(frontend): section-specific roast effects"
```

---

### Task 6.5: Avatar effects

**Files:**
- Create: `frontend/js/chaos/effects/avatarRotate.js`
- Create: `frontend/js/chaos/effects/avatarScatter.js`
- Modify: `frontend/css/chaos.css`
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append CSS**

```css
@keyframes slow-rotate { to { transform: rotate(360deg); } }
.fx-avatar-rotate { animation: slow-rotate 4s linear infinite; }

@keyframes backflip { to { transform: rotate(360deg) scale(1.4); } }
.fx-backflip { animation: backflip 0.6s ease-in-out; }

.fx-avatar-clone {
  position: fixed;
  border-radius: 50%;
  object-fit: cover;
  pointer-events: none;
  z-index: 50;
}
```

- [ ] **Step 2: Implement effects**

`frontend/js/chaos/effects/avatarRotate.js`:

```js
export default {
  name: 'avatarRotate',
  targets: 'image',
  density: 1,
  apply(el) {
    el.classList.add('fx-avatar-rotate');
    el.addEventListener('click', () => {
      el.classList.remove('fx-avatar-rotate');
      el.classList.add('fx-backflip');
      setTimeout(() => {
        el.classList.remove('fx-backflip');
        el.classList.add('fx-avatar-rotate');
      }, 600);
    });
  },
};
```

`frontend/js/chaos/effects/avatarScatter.js`:

```js
import { randInt } from '../../rng.js';
export default {
  name: 'avatarScatter',
  targets: 'image',
  density: 1,
  apply(el, rng) {
    const isImg = el.tagName === 'IMG';
    const count = randInt(rng, 3, 5);
    for (let i = 0; i < count; i++) {
      const clone = isImg ? el.cloneNode(true) : document.createElement('div');
      if (!isImg) {
        clone.textContent = el.textContent;
        clone.style.fontSize = `${randInt(rng, 40, 100)}px`;
        clone.style.display = 'flex';
        clone.style.alignItems = 'center';
        clone.style.justifyContent = 'center';
      }
      clone.classList.add('fx-avatar-clone');
      const size = randInt(rng, 60, 140);
      clone.style.width = `${size}px`;
      clone.style.height = `${size}px`;
      clone.style.top = `${randInt(rng, 5, 80)}vh`;
      clone.style.left = `${randInt(rng, 5, 90)}vw`;
      clone.style.transform = `rotate(${randInt(rng, -45, 45)}deg)`;
      document.body.appendChild(clone);
    }
  },
};
```

- [ ] **Step 3: Register**

```js
import avatarRotate from './effects/avatarRotate.js';
import avatarScatter from './effects/avatarScatter.js';
EFFECTS.push(avatarRotate, avatarScatter);
```

- [ ] **Step 4: Smoke test**

Reload. Verify: corner avatar slowly spins, multiple copies of avatar scattered, clicking avatar triggers backflip.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/ frontend/css/chaos.css
git commit -m "feat(frontend): avatar chaos effects (rotate, scatter, backflip)"
```

---

### Task 6.6: Interaction effects

**Files:**
- Create: `frontend/js/chaos/effects/customCursor.js`
- Create: `frontend/js/chaos/effects/sectionWobble.js`
- Create: `frontend/js/chaos/effects/konamiMaxChaos.js`
- Modify: `frontend/css/chaos.css`
- Modify: `frontend/js/chaos/registry.js`

- [ ] **Step 1: Append CSS**

```css
body.fx-comic-cursor, body.fx-comic-cursor * {
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text y='28' font-family='Comic Sans MS' font-size='28'>👉</text></svg>") 0 0, auto;
}

@keyframes wobble {
  0%, 100% { transform: scale(1.5) rotate(0); }
  25% { transform: scale(1.5) rotate(3deg); }
  75% { transform: scale(1.5) rotate(-3deg); }
}
.fx-wobble { animation: wobble 0.4s ease-in-out infinite; z-index: 100; position: relative; }

.fx-confetti {
  position: fixed;
  width: 8px; height: 8px;
  pointer-events: none;
  z-index: 999;
}
@keyframes confetti-fall {
  to { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
```

- [ ] **Step 2: Implement effects**

`frontend/js/chaos/effects/customCursor.js`:

```js
export default {
  name: 'customCursor',
  targets: 'page',
  density: 1,
  apply() { document.body.classList.add('fx-comic-cursor'); },
};
```

`frontend/js/chaos/effects/sectionWobble.js`:

```js
export default {
  name: 'sectionWobble',
  targets: 'section',
  density: 1,
  apply(el) {
    el.addEventListener('mouseenter', () => el.classList.add('fx-wobble'));
    el.addEventListener('mouseleave', () => el.classList.remove('fx-wobble'));
  },
};
```

`frontend/js/chaos/effects/konamiMaxChaos.js`:

```js
import { pick, randInt } from '../../rng.js';
const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default {
  name: 'konamiMaxChaos',
  targets: 'page',
  density: 1,
  apply(_el, rng) {
    let buf = [];
    document.addEventListener('keydown', (e) => {
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      buf = buf.slice(-SEQUENCE.length);
      if (buf.join(',') === SEQUENCE.join(',')) trigger(rng);
    });
  },
};

function trigger(rng) {
  document.documentElement.style.setProperty('--chaos-speed', '2');
  fireConfetti(rng);
  playDialup();
}

function fireConfetti(rng) {
  const colors = ['#f0f', '#0ff', '#ff0', '#f00', '#0f0'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'fx-confetti';
    c.style.background = pick(rng, colors);
    c.style.left = `${randInt(rng, 0, 100)}vw`;
    c.style.top = '-10vh';
    c.style.animation = `confetti-fall ${randInt(rng, 2000, 4000)}ms linear forwards`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

function playDialup() {
  // Brief WebAudio approximation of a modem screech.
  // Konami keypress counts as a user interaction, so audio is permitted.
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 1.5);
  gain.gain.setValueAtTime(0.03, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}
```

- [ ] **Step 3: Register**

```js
import customCursor from './effects/customCursor.js';
import sectionWobble from './effects/sectionWobble.js';
import konamiMaxChaos from './effects/konamiMaxChaos.js';
EFFECTS.push(customCursor, sectionWobble, konamiMaxChaos);
```

- [ ] **Step 4: Smoke test**

Reload. Verify: emoji cursor, hovering sections wobbles them. Type `↑↑↓↓←→←→BA`: animations should speed up, confetti rain, brief modem screech.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/chaos/ frontend/css/chaos.css
git commit -m "feat(frontend): interaction effects (cursor, wobble, Konami)"
```

---

## Phase 7 — Polish

### Task 7.1: Download-as-HTML button

**Files:**
- Create: `frontend/js/download.js`
- Modify: `frontend/js/viewer.js`

The download trick: clone the live document, inline images as base64 data URLs, inline the stylesheets, strip scripts, serialize via `outerHTML` (the only safe-by-construction usage we have — it's reading from a DOM we built, not parsing untrusted strings into one).

- [ ] **Step 1: Implement download module**

`frontend/js/download.js`:

```js
export async function downloadAsHtml(filename = 'enhanced-cv.html') {
  // Work on a clone so we don't mutate the live page.
  const clone = document.documentElement.cloneNode(true);

  // Inline images as base64 data URLs.
  const liveImages = Array.from(document.images);
  const cloneImages = Array.from(clone.querySelectorAll('img'));
  for (let i = 0; i < cloneImages.length; i++) {
    const liveSrc = liveImages[i] ? liveImages[i].src : cloneImages[i].src;
    if (liveSrc && !liveSrc.startsWith('data:')) {
      try {
        const dataUrl = await imageToDataUrl(liveSrc);
        cloneImages[i].setAttribute('src', dataUrl);
      } catch (e) {
        console.warn('Failed to inline image', liveSrc, e);
      }
    }
  }

  // Inline stylesheets.
  const links = Array.from(clone.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of links) {
    try {
      const css = await fetch(link.href).then((r) => r.text());
      const style = document.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    } catch (e) {
      console.warn('Failed to inline stylesheet', link.href, e);
    }
  }

  // Strip scripts so the artifact is fully static.
  clone.querySelectorAll('script').forEach((s) => s.remove());

  const html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function imageToDataUrl(src) {
  const resp = await fetch(src);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 2: Wire button in `viewer.js`**

Append to `viewer.js`:

```js
import { downloadAsHtml } from './download.js';

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btn-download') {
    e.preventDefault();
    downloadAsHtml();
  }
});
```

- [ ] **Step 3: Smoke test**

Click download button. Verify: `enhanced-cv.html` downloads. Open the file in a fresh browser tab. Verify: chaos still renders, images visible, no broken paths.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/download.js frontend/js/viewer.js
git commit -m "feat(frontend): download enhanced CV as self-contained HTML"
```

---

### Task 7.2: Copy-share-link button

**Files:**
- Modify: `frontend/js/viewer.js`

- [ ] **Step 1: Wire share button**

Append to `viewer.js`:

```js
document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btn-share') {
    try {
      await navigator.clipboard.writeText(window.location.href);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { e.target.textContent = '📋 Copy share link'; }, 1500);
    } catch {
      e.target.textContent = 'Copy failed — select URL manually';
    }
  }
});
```

- [ ] **Step 2: Smoke test**

Click share button. Verify: URL is in clipboard (paste into address bar of new tab).

- [ ] **Step 3: Commit**

```bash
git add frontend/js/viewer.js
git commit -m "feat(frontend): copy share link button"
```

---

### Task 7.3: Error 404 page

**Files:**
- Create: `frontend/404.html`

- [ ] **Step 1: Create the 404 page**

`frontend/404.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 — CV Ascended</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Comic Sans MS', cursive;
      background: linear-gradient(45deg, #f0f, #0ff);
      animation: pulse 3s linear infinite;
      padding: 2rem;
      text-align: center;
    }
    @keyframes pulse {
      0%, 100% { background: linear-gradient(45deg, #f0f, #0ff); }
      50% { background: linear-gradient(45deg, #ff0, #f00); }
    }
    h1 { font-size: 4rem; margin: 0; color: #fff; text-shadow: 4px 4px 0 #000; }
    p { font-size: 1.25rem; color: #fff; max-width: 480px; }
    a { color: #ff0; font-weight: 900; }
  </style>
</head>
<body>
  <h1>404 ✨</h1>
  <p>This CV has been so enhanced it ascended to a higher plane.</p>
  <p>(Or it expired after 30 days. Probably the higher plane though.)</p>
  <p><a href="/">← Back to enhance another one</a></p>
</body>
</html>
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:4280/cv/zzzzzzzz`. Verify: friendly 404 page renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/404.html
git commit -m "feat(frontend): chaotic 404 page"
```

---

## Phase 8 — Infrastructure & deployment

### Task 8.1: Bicep infrastructure

**Files:**
- Create: `infra/main.bicep`
- Create: `infra/main.parameters.json`
- Create: `azure.yaml`

- [ ] **Step 1: Create `infra/main.bicep`**

```bicep
@description('Environment name (e.g., dev, prod)')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Repo URL for SWA deployment (set when first deploying)')
param repositoryUrl string = ''

var token = uniqueString(resourceGroup().id, environmentName)
var storageName = toLower('cve${environmentName}${take(token, 8)}')
var swaName = 'swa-cvenhancer-${environmentName}-${take(token, 6)}'

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
  properties: {
    repositoryUrl: repositoryUrl
    branch: 'main'
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
```

- [ ] **Step 2: Create `infra/main.parameters.json`**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" }
  }
}
```

- [ ] **Step 3: Create `azure.yaml` for `azd`**

```yaml
name: cvenhancer
metadata:
  template: azd-init@1.0.0
infra:
  provider: bicep
  path: infra
  module: main
services:
  web:
    project: .
    language: ts
    host: staticwebapp
```

- [ ] **Step 4: Commit**

```bash
git add infra/ azure.yaml
git commit -m "chore(infra): Bicep template for SWA + Storage with 30-day lifecycle"
```

---

### Task 8.2: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/azure-deploy.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Azure SWA Deploy

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true

      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: 'frontend'
          api_location: 'api'
          output_location: ''

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request
    steps:
      - name: Close PR
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: 'close'
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/azure-deploy.yml
git commit -m "ci: GitHub Actions workflow for SWA deployment"
```

---

### Task 8.3: First deployment with `azd` (runbook)

This is a runbook executed by the engineer, not a code task.

- [ ] **Step 1: Push the repo to GitHub**

```bash
git remote add origin https://github.com/<your-user>/CVEnhancer.git
git push -u origin main
```

- [ ] **Step 2: Run `azd up` in the repo root**

```bash
azd auth login
azd up
```

`azd` prompts for an environment name (`dev`) and Azure region (e.g., `eastus`). Expected: resources created (Storage, Static Web App). At the end, `azd` outputs the SWA hostname.

- [ ] **Step 3: Connect SWA deployment token to GitHub**

In the Azure Portal → your SWA resource → Manage deployment token → copy the token. In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN` with the token value.

- [ ] **Step 4: Trigger a deployment**

```bash
git commit --allow-empty -m "chore: trigger first deploy"
git push
```

Watch the GitHub Actions run. When green, visit the SWA hostname.

- [ ] **Step 5: Smoke test the deployed site**

- Open the landing page
- Upload a sample PDF
- Get redirected to `/cv/<id>`
- Verify chaos renders
- Reload — same chaos
- Open in incognito with the same URL — same chaos
- Click download — `.html` file downloads, opens with chaos preserved
- Click share — URL in clipboard
- Visit `/cv/zzzzzzzz` — friendly 404

- [ ] **Step 6: Verify blob lifecycle policy**

In the Azure Portal → Storage account → Lifecycle management. Confirm the `expire-30-days` rule exists and is enabled.

---

### Task 8.4: README polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README with a complete version**

````markdown
# CVEnhancer

> *Sad because HR ignored your CV? We got you.*

A meme website that "enhances" your CV by re-rendering it as a chaotic visual disaster. Live at: `<your-deployment-url>`

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

# Run the full stack locally — three terminals:
azurite --silent                          # terminal 1 (storage)
cd api && func start                      # terminal 2 (functions)
swa start frontend --api-location api     # terminal 3 (SWA proxy on :4280)
```

Open `http://localhost:4280`.

## Tests

```bash
cd api
pytest tests/ -v
```

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

After `azd up`, configure GitHub Actions deployment by adding the SWA deployment token from the portal as the `AZURE_STATIC_WEB_APPS_API_TOKEN` repo secret.

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

2. Add an import + `EFFECTS.push(myEffect)` in `frontend/js/chaos/registry.js`.
3. Add any required CSS (keyframes, classes prefixed `.fx-`) to `frontend/css/chaos.css`.

That's it. No orchestrator changes needed.

## Design

See `docs/superpowers/specs/2026-05-03-cvenhancer-design.md`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with local dev, smoke tests, and effect-extensibility guide"
```

---

## Done

The site should now be deployed and functional. Future work (post-v1) is documented in §10 of the design spec: user accounts via SWA built-in auth, PDF/image rendering via Playwright, sample-CV demo button, and more chaos effects via the registry pattern.

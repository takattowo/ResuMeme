import json
import logging
import os
import re
from datetime import datetime, timezone

import azure.functions as func

from shared.blob_client import BlobClient
from shared.docx_parser import extract_docx
from shared.id_gen import generate_id
from shared.llm_client import generate_roasts
from shared.pdf_parser import extract_pdf
from shared.rate_limiter import check as rate_check, client_ip, record as rate_record
from shared.resume_filter import looks_like_resume
from shared.section_splitter import split_sections

MAX_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"
DOCX_MAGIC = b"PK\x03\x04"
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{6,16}$")

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


@app.route(route="diag", methods=["GET"])
def diag(req: func.HttpRequest) -> func.HttpResponse:
    from shared.llm_client import diagnose
    return func.HttpResponse(
        body=json.dumps(diagnose()),
        status_code=200,
        mimetype="application/json",
    )


@app.route(route="upload", methods=["POST"])
def upload(req: func.HttpRequest) -> func.HttpResponse:
    storage_conn = os.environ.get("STORAGE_CONNECTION_STRING", "")
    ip = client_ip(req.headers)
    ok, retry_after, reason = rate_check(storage_conn, ip)
    if not ok:
        if reason == "daily_cap":
            msg = "You have hit today's upload limit from this IP. Try again tomorrow."
        else:
            msg = f"Slow down. Please wait {retry_after} seconds before uploading again."
        resp = _json_error(429, "rate_limited", msg)
        resp.headers["Retry-After"] = str(retry_after)
        return resp

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
        parsed = {"raw_text": "", "images": [], "page_count": 1}

    ok, reason = looks_like_resume(parsed["raw_text"], parsed.get("page_count", 1))
    if not ok:
        return _json_error(422, "not_a_resume", reason)

    sections = split_sections(parsed["raw_text"])

    # AI is best-effort. None = fall back to generic frontend content.
    ai_content = generate_roasts(
        parsed["raw_text"],
        sections.get("name", ""),
        sections.get("items", []),
    )

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
        "aiContent": ai_content,
    }
    bc.write_json(f"{cv_id}.json", document)
    rate_record(storage_conn, ip)

    return func.HttpResponse(
        body=json.dumps({"id": cv_id, "url": f"/cv/{cv_id}"}),
        status_code=200,
        mimetype="application/json",
    )


@app.route(route="cv/{cv_id}", methods=["GET"])
def get_cv(req: func.HttpRequest) -> func.HttpResponse:
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

from io import BytesIO
from types import SimpleNamespace

import pytest

import function_app
from function_app import _content_type_for_image, _detect_kind, _presentation_mode, ID_PATTERN

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


def test_presentation_mode_requires_an_explicit_valid_choice():
    assert _presentation_mode(None) is None
    assert _presentation_mode("") is None
    assert _presentation_mode(" MODERN ") == "modern"
    assert _presentation_mode("professional") == "professional"
    assert _presentation_mode("chaos") == "chaos"
    assert _presentation_mode("serious-but-evil") is None


def test_upload_requires_presentation_choice(monkeypatch):
    monkeypatch.setattr(function_app, "client_ip", lambda _headers: "198.51.100.1")
    monkeypatch.setattr(function_app, "rate_check", lambda _conn, _ip: (True, 0, ""))

    response = function_app.upload(
        SimpleNamespace(headers={}, files={"file": BytesIO(PDF_MAGIC)}, form={})
    )

    assert response.status_code == 400
    assert b'"error": "bad_presentation"' in response.get_body()


def test_upload_records_attempt_before_parsing(monkeypatch):
    events = []
    monkeypatch.setattr(function_app, "client_ip", lambda _headers: "198.51.100.1")
    monkeypatch.setattr(function_app, "rate_check", lambda _conn, _ip: (True, 0, ""))
    monkeypatch.setattr(function_app, "rate_record", lambda _conn, _ip: events.append("record"))
    monkeypatch.setattr(
        function_app,
        "extract_pdf",
        lambda _body: events.append("parse") or {
            "raw_text": "not a resume",
            "images": [],
            "page_count": 1,
            "author": "",
        },
    )
    monkeypatch.setattr(function_app, "looks_like_resume", lambda _text, _pages: (False, "no"))

    response = function_app.upload(
        SimpleNamespace(
            headers={},
            files={"file": BytesIO(b"%PDF-1.4")},
            form={"presentation": "chaos"},
        )
    )

    assert response.status_code == 422
    assert events == ["record", "parse"]


@pytest.mark.parametrize(
    ("mode", "expects_ai"),
    [("modern", False), ("professional", False), ("chaos", True)],
)
def test_upload_persists_mode_and_only_uses_ai_for_chaos(monkeypatch, mode, expects_ai):
    written = {}
    ai_calls = []
    ai_result = {"hero": {"bio": "Invented chaos"}}
    monkeypatch.setattr(function_app, "client_ip", lambda _headers: "198.51.100.1")
    monkeypatch.setattr(function_app, "rate_check", lambda _conn, _ip: (True, 0, ""))
    monkeypatch.setattr(function_app, "rate_record", lambda _conn, _ip: None)
    monkeypatch.setattr(
        function_app,
        "extract_pdf",
        lambda _body: {
            "raw_text": "Experience\nBuilt serious-looking nonsense",
            "images": [],
            "page_count": 1,
            "author": "",
        },
    )
    monkeypatch.setattr(function_app, "looks_like_resume", lambda _text, _pages: (True, ""))
    monkeypatch.setattr(
        function_app,
        "split_sections",
        lambda _text, fallback_name="": {"name": "Test User", "items": []},
    )
    monkeypatch.setattr(
        function_app,
        "generate_roasts",
        lambda *_args: ai_calls.append(True) or ai_result,
    )
    monkeypatch.setattr(function_app, "generate_id", lambda: "Style123")
    monkeypatch.setattr(
        function_app,
        "_blob_client",
        lambda: SimpleNamespace(
            write_json=lambda path, document: written.update(path=path, document=document)
        ),
    )

    response = function_app.upload(
        SimpleNamespace(
            headers={},
            files={"file": BytesIO(PDF_MAGIC)},
            form={"presentation": mode},
        )
    )

    assert response.status_code == 200
    assert written["path"] == "Style123.json"
    assert written["document"]["presentationMode"] == mode
    assert written["document"]["aiContent"] == (ai_result if expects_ai else None)
    assert bool(ai_calls) is expects_ai

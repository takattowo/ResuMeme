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

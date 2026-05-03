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

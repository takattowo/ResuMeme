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


def test_extract_pdf_raises_on_invalid_data():
    with pytest.raises(Exception):
        extract_pdf(b"this is not a pdf")

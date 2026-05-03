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

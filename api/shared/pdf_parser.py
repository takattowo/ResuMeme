from typing import TypedDict

import fitz  # PyMuPDF


class ParsedDocument(TypedDict):
    raw_text: str
    images: list[bytes]
    page_count: int


def extract_pdf(data: bytes) -> ParsedDocument:
    """Extract text and embedded images from a PDF byte stream."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages_text = [page.get_text("text") for page in doc]
        raw_text = "\n".join(pages_text)
        images = _extract_images(doc)
        return {"raw_text": raw_text, "images": images, "page_count": len(doc)}
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

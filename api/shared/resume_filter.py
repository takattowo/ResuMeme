import re

MAX_PAGES = 4
MIN_TEXT_LENGTH = 100

_KEYWORDS = re.compile(
    r"\b(experience|education|skills?|summary|profile|objective|"
    r"work\s*history|employment|qualifications|competencies|certifications)\b",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def looks_like_resume(text: str, page_count: int) -> tuple[bool, str]:
    """Cheap heuristic. Returns (ok, message_if_rejected)."""
    if page_count > MAX_PAGES:
        return (
            False,
            f"Resumes shouldn't exceed {MAX_PAGES} pages. We don't read books here.",
        )
    if len(text.strip()) < MIN_TEXT_LENGTH:
        return False, "We couldn't find enough text in this. Is this a CV or just vibes?"
    if not _KEYWORDS.search(text) and not _EMAIL.search(text):
        return (
            False,
            "This doesn't look like a CV. We need at least one section heading or contact info.",
        )
    return True, ""

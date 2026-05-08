import re
from typing import TypedDict

KNOWN_HEADINGS: dict[str, list[str]] = {
    "summary": ["summary", "profile", "objective", "about", "professional summary", "personal statement"],
    "experience": ["experience", "employment", "work history", "professional experience", "work experience", "employment history", "career history"],
    "skills": ["skills", "technical skills", "competencies", "core competencies", "key skills", "technologies", "tools", "tech stack"],
    "education": ["education", "academic background", "qualifications", "academic qualifications"],
    "certifications": ["certifications", "certificates", "licenses", "credentials"],
    "projects": ["projects", "personal projects", "personal project", "portfolio", "selected projects", "key projects", "side projects"],
    "freelance": ["freelance", "freelance work", "freelance experience", "freelance present", "consulting", "consulting experience"],
    "languages": ["languages", "language proficiency", "spoken languages"],
    "awards": ["awards", "honors", "honours", "achievements", "accomplishments"],
    "publications": ["publications", "papers"],
    "references": ["references"],
    "interests": ["interests", "hobbies", "activities"],
    "volunteer": ["volunteer experience", "volunteering", "community involvement", "volunteer work"],
}


class SectionItem(TypedDict):
    heading: str       # display heading (original casing minus trailing colon)
    canonical: str     # normalized key for chaos effects to switch on
    body: str          # logical paragraphs separated by single newlines


class Sections(TypedDict):
    name: str
    title: str
    items: list[SectionItem]
    raw_text: str


_BULLET_RE = re.compile(r"^\s*([-•*►▪◦‣⋅▸·]|\d+[.\)])\s")
_SENTENCE_END = re.compile(r"[.!?][\"')\]]?\s*$")
_HEADING_CHARS = re.compile(r"^[A-Za-z][A-Za-z\s/&\-:]*$")

# Page header / footer patterns that should never be treated as the candidate's name.
_PAGE_CHROME_PATTERNS = [
    re.compile(r"\bpage\s+\d+\s+of\s+\d+\b", re.IGNORECASE),
    re.compile(r"\bpage\s+\d+\b", re.IGNORECASE),
    re.compile(r"\bconfidential(?:\s+information)?\b", re.IGNORECASE),
    re.compile(r"\b(?:curriculum\s+vitae|resum[eé])\b", re.IGNORECASE),
    re.compile(r"^\s*\d{1,3}\s*$"),
    re.compile(r"^\s*https?://", re.IGNORECASE),
    re.compile(r"^\s*[\w.+-]+@[\w.-]+\.\w+\s*$"),
    re.compile(r"^\s*\+?[\d\s().\-]{7,}\s*$"),
]

# Lines bearing a corporate suffix are branding, not a person's name.
_COMPANY_SUFFIX_RE = re.compile(
    r"\b(?:Technology|Technologies|Inc\.?|Incorporated|Corp\.?|Corporation|Ltd\.?|Limited|"
    r"LLC|GmbH|AG|Pty|Company|Co\.?|Solutions|Group|Consulting|Services|Holdings|"
    r"Bank|Foundation|Institute)\b",
    re.IGNORECASE,
)

# Letters allowed inside a real human name (Latin + diacritics + Vietnamese ranges).
_NAME_VALID_CHARS_RE = re.compile(r"^[A-Za-zÀ-ɏḀ-ỿ\s.,'\-]+$")

# Words that signal a job title rather than a person's name.
_ROLE_KEYWORDS_RE = re.compile(
    r"\b(?:engineer|developer|programmer|consultant|manager|analyst|designer|"
    r"architect|specialist|administrator|coordinator|director|officer|intern|"
    r"associate|assistant|technician|scientist|recruiter|accountant|president|"
    r"founder|ceo|cto|cfo|coo|cmo|cio|vp|svp|evp|head|chief|lead|principal|"
    r"manager|owner|partner|advisor|qa|sde|swe|fullstack|frontend|backend)\b",
    re.IGNORECASE,
)


def _is_page_chrome(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    for pat in _PAGE_CHROME_PATTERNS:
        if pat.search(s):
            return True
    if _COMPANY_SUFFIX_RE.search(s):
        return True
    return False


def _looks_like_human_name(line: str) -> bool:
    s = line.strip().rstrip(",.")
    if not (4 <= len(s) <= 50):
        return False
    if not _NAME_VALID_CHARS_RE.match(s):
        return False
    if _ROLE_KEYWORDS_RE.search(s):
        return False
    words = [w for w in re.split(r"[\s,]+", s) if w]
    if not (2 <= len(words) <= 5):
        return False
    return any(w[:1].isupper() for w in words)


def _is_known_heading(line: str) -> tuple[bool, str, str]:
    text = line.strip().rstrip(":")
    if not text or len(text) > 50:
        return False, "", ""
    cleaned = text.lower()
    for canonical, aliases in KNOWN_HEADINGS.items():
        for alias in aliases:
            if cleaned == alias:
                return True, canonical, text
    return False, "", ""


def _detect_generic_heading(line: str) -> tuple[bool, str, str]:
    """Generic heading heuristic, NOT including the known-list check.

    Returns (is_heading, canonical_key, display_text). Used only when the
    parser knows the previous line was blank, since CV body lines (cert
    names, project titles, etc.) are often title-cased but not headings.
    """
    text = line.strip()
    if not text:
        return False, "", ""
    if len(text) > 50:
        return False, "", ""
    if not _HEADING_CHARS.match(text):
        return False, "", ""
    text_clean = text.rstrip(":").strip()
    alpha_words = [w for w in text_clean.split() if any(c.isalpha() for c in w)]
    if len(alpha_words) < 1 or len(alpha_words) > 5:
        return False, "", ""
    is_all_caps = all(w.isupper() for w in alpha_words)
    is_title_case = all(w[0].isupper() for w in alpha_words if w[0].isalpha())
    if is_all_caps or (is_title_case and len(alpha_words) >= 2):
        return True, text_clean.lower(), text_clean
    return False, "", ""


def _detect_heading(line: str) -> tuple[bool, str, str]:
    """Compatibility wrapper: known-list match OR generic heuristic.

    Used by the merge step where blank-line context is unavailable. Real
    parsing uses the split known/generic functions to apply blank-line gating.
    """
    is_known, canon, display = _is_known_heading(line)
    if is_known:
        return True, canon, display
    return _detect_generic_heading(line)


def _merge_wrapped_lines(text: str) -> str:
    """Join soft-wrapped continuation lines into single logical lines.

    Keeps the line break when:
    - line is empty
    - next line starts with a bullet/number marker
    - next line is a section heading
    - previous line ended with sentence-final punctuation
    - previous line was a section heading

    Hyphenated wrap: "high-\nvolume" merges as "high-volume".
    """
    lines = text.splitlines()
    out: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            if out and out[-1] != "":
                out.append("")
            continue
        if not out or out[-1] == "":
            out.append(line)
            continue
        prev = out[-1]
        is_new_paragraph = (
            _BULLET_RE.match(line)
            or _SENTENCE_END.search(prev)
            or _detect_heading(line)[0]
            or _detect_heading(prev)[0]
        )
        if is_new_paragraph:
            out.append(line)
            continue
        # Continuation. Hyphen wrap: drop the soft-wrap space.
        if prev.endswith("-") and not prev.endswith(" -"):
            out[-1] = prev + line
        else:
            out[-1] = prev + " " + line
    return "\n".join(out)


def _extract_name_and_title(
    lines: list[str], fallback_name: str = ""
) -> tuple[str, str, int]:
    """Pull name + title from leading non-empty lines.

    Skips page-chrome (page numbers, confidentiality notices, corporate
    headers) before picking a candidate. Falls back to `fallback_name` (e.g.
    PDF /Author or DOCX core_properties.author) when the document's first
    visible line doesn't look like a real human name.
    """
    fb = (fallback_name or "").strip()
    non_empty = [(i, ln.strip()) for i, ln in enumerate(lines) if ln.strip()]
    if not non_empty:
        return (fb if _looks_like_human_name(fb) else fb), "", 0

    plausible: list[tuple[int, str]] = []
    first_heading_idx: int | None = None
    for i, ln in non_empty:
        if _is_page_chrome(ln):
            continue
        if _is_known_heading(ln)[0]:
            first_heading_idx = i
            break
        plausible.append((i, ln))

    if not plausible:
        name = fb if _looks_like_human_name(fb) else fb
        if first_heading_idx is not None:
            return name, "", first_heading_idx
        return name, "", non_empty[-1][0] + 1

    cand_i, cand_ln = plausible[0]

    if _looks_like_human_name(cand_ln):
        name = cand_ln
        if len(plausible) >= 2:
            t_i, t_ln = plausible[1]
            return name, t_ln, t_i + 1
        return name, "", cand_i + 1

    if fb and _looks_like_human_name(fb):
        # Metadata wins; current line was likely a job title or junk.
        return fb, cand_ln, cand_i + 1

    # Legacy fallback: trust the first non-chrome line even if shape is odd.
    name = cand_ln
    if len(plausible) >= 2:
        t_i, t_ln = plausible[1]
        return name, t_ln, t_i + 1
    return name, "", cand_i + 1


def split_sections(text: str, fallback_name: str = "") -> Sections:
    raw_lines = text.splitlines()
    name, title, start = _extract_name_and_title(raw_lines, fallback_name)

    body_text = "\n".join(raw_lines[start:])
    merged_body = _merge_wrapped_lines(body_text)
    body_lines = merged_body.splitlines()

    items: list[SectionItem] = []
    current_heading = ""
    current_canonical = ""
    current_body: list[str] = []
    prev_blank = True  # treat start of body as "after a blank line"

    def flush() -> None:
        if current_heading:
            joined = "\n".join(current_body).strip("\n")
            if joined:
                items.append({
                    "heading": current_heading,
                    "canonical": current_canonical,
                    "body": joined,
                })

    for raw_line in body_lines:
        stripped = raw_line.strip()
        if not stripped:
            if current_heading and current_body and current_body[-1] != "":
                current_body.append("")
            prev_blank = True
            continue

        # Known-list headings always count. Generic title-case detection only
        # counts if preceded by a blank line, otherwise CV body lines (cert
        # names, project titles, language pairs) get falsely promoted.
        is_known, canon, display = _is_known_heading(stripped)
        is_h = is_known
        if not is_known and prev_blank:
            generic_h, generic_canon, generic_display = _detect_generic_heading(stripped)
            if generic_h:
                is_h = True
                canon, display = generic_canon, generic_display

        if is_h:
            flush()
            current_heading = display
            current_canonical = canon
            current_body = []
        elif current_heading:
            current_body.append(stripped)
        prev_blank = False

    flush()

    full_merged = "\n".join(raw_lines[:start] + body_lines)
    return {
        "name": name,
        "title": title,
        "items": items,
        "raw_text": full_merged,
    }

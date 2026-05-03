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

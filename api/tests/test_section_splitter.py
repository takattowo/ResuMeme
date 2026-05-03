from shared.section_splitter import split_sections


def _by_canon(result):
    return {item["canonical"]: item["body"] for item in result["items"]}


def test_split_sections_finds_known_headings():
    text = """\
Jane Doe
Senior Engineer

Summary
I do things with computers.

Experience
Acme - 2020-2024.
Built stuff.

Skills
Python, JavaScript

Education
BSc, 2016
"""
    result = split_sections(text)
    by_canon = _by_canon(result)
    assert "I do things with computers" in by_canon["summary"]
    assert "Acme" in by_canon["experience"]
    assert "Python" in by_canon["skills"]
    assert "BSc" in by_canon["education"]


def test_split_sections_handles_missing_headings():
    text = "Just a blob of text with no recognizable structure."
    result = split_sections(text)
    assert result["items"] == []


def test_split_sections_is_case_insensitive():
    text = "EXPERIENCE\nDid things\nSKILLS\nPython"
    result = split_sections(text)
    by_canon = _by_canon(result)
    assert "Did things" in by_canon["experience"]
    assert "Python" in by_canon["skills"]


def test_split_sections_extracts_name_from_first_line():
    text = "Jane Doe\nSenior Engineer\n\nSummary\nstuff"
    result = split_sections(text)
    assert result["name"] == "Jane Doe"
    assert result["title"] == "Senior Engineer"


def test_detects_certifications_and_projects():
    text = (
        "Jane Doe\nDeveloper\n\n"
        "Certifications\nAWS Solutions Architect.\n\n"
        "Projects\nBuilt a thing.\n"
    )
    result = split_sections(text)
    by_canon = _by_canon(result)
    assert "AWS Solutions Architect" in by_canon["certifications"]
    assert "Built a thing" in by_canon["projects"]


def test_merges_soft_wrapped_lines_with_hyphen():
    text = (
        "Jane Doe\nDev\n\n"
        "Experience\n"
        "Built scalable systems handling high-\n"
        "volume document lifecycles.\n"
    )
    result = split_sections(text)
    by_canon = _by_canon(result)
    body = by_canon["experience"]
    assert "high-volume document lifecycles" in body
    assert "high-\nvolume" not in body
    assert "high- volume" not in body


def test_merges_wrapped_continuation_with_space():
    text = (
        "Jane Doe\nDev\n\n"
        "Experience\n"
        "L2-L3 support for a life-sciences regulatory platform handling\n"
        "high-volume document lifecycles and strict compliance.\n"
    )
    result = split_sections(text)
    by_canon = _by_canon(result)
    body = by_canon["experience"]
    assert "handling high-volume" in body
    assert body.count("\n") == 0


def test_detects_unknown_heading_via_caps_heuristic():
    text = (
        "Jane Doe\nDev\n\n"
        "AWARDS\n"
        "Won the thing in 2024.\n"
    )
    result = split_sections(text)
    by_canon = _by_canon(result)
    assert "Won the thing" in by_canon["awards"]


def test_cert_list_items_are_not_promoted_to_headings():
    """Real bug from a deployed CV: cert lines were treated as headings
    because they pass the title-case heuristic. Fixed by requiring a
    blank line before generic-detected headings."""
    text = (
        "Jane Doe\nCloud Engineer\n\n"
        "Certifications\n"
        "Azure Engineer Expert\n"
        "AWS Architect Associate\n"
        "Microsoft Certified: Azure AI\n"
    )
    result = split_sections(text)
    by_canon = _by_canon(result)
    assert "certifications" in by_canon
    body = by_canon["certifications"]
    assert "Azure Engineer Expert" in body
    assert "AWS Architect Associate" in body
    # Should NOT have been promoted to their own sections.
    assert "azure engineer expert" not in by_canon
    assert "aws architect associate" not in by_canon


def test_does_not_treat_short_title_as_heading():
    text = "Jane Doe\nDev\n\nSummary\nShe writes code."
    result = split_sections(text)
    assert result["name"] == "Jane Doe"
    assert result["title"] == "Dev"
    by_canon = _by_canon(result)
    assert "She writes code" in by_canon["summary"]

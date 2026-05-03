from shared.section_splitter import split_sections


def test_split_sections_finds_known_headings():
    text = """\
Jane Doe
Senior Engineer

Summary
I do things with computers.

Experience
Acme - 2020-2024
Built stuff.

Skills
Python, JavaScript

Education
BSc, 2016
"""
    result = split_sections(text)
    assert "I do things with computers" in result["summary"]
    assert "Acme" in result["experience"]
    assert "Python" in result["skills"]
    assert "BSc" in result["education"]
    assert result["raw_text"] == text


def test_split_sections_handles_missing_headings():
    text = "Just a blob of text with no recognizable structure."
    result = split_sections(text)
    assert result["summary"] == ""
    assert result["experience"] == ""
    assert result["skills"] == ""
    assert result["education"] == ""
    assert result["raw_text"] == text


def test_split_sections_is_case_insensitive():
    text = "EXPERIENCE\nDid things\nSKILLS\nPython"
    result = split_sections(text)
    assert "Did things" in result["experience"]
    assert "Python" in result["skills"]


def test_split_sections_extracts_name_from_first_line():
    text = "Jane Doe\nSenior Engineer\n\nSummary\nstuff"
    result = split_sections(text)
    assert result["name"] == "Jane Doe"
    assert result["title"] == "Senior Engineer"

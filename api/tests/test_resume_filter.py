from shared.resume_filter import looks_like_resume


def test_accepts_typical_cv():
    text = (
        "Jane Doe\nSenior Engineer\n\nSummary\nExperienced engineer.\n"
        "Experience\nAcme Corp 2020-2024\n"
        "Skills\nPython, JavaScript\n"
        "Education\nBSc Computer Science\n"
    )
    ok, _ = looks_like_resume(text, page_count=2)
    assert ok is True


def test_rejects_too_many_pages():
    ok, reason = looks_like_resume(
        "Has Experience and Education enough text " * 20, page_count=5
    )
    assert ok is False
    assert "page" in reason.lower()


def test_rejects_too_little_text():
    ok, reason = looks_like_resume("hi there", page_count=1)
    assert ok is False


def test_rejects_no_keywords_or_email():
    text = "This is a story about a banana that fell from a tree. " * 10
    ok, reason = looks_like_resume(text, page_count=1)
    assert ok is False


def test_accepts_email_only_no_keywords():
    text = (
        "Random prose about a person named John who lives somewhere "
        "and can be reached at john@example.com when needed. " * 3
    )
    ok, _ = looks_like_resume(text, page_count=1)
    assert ok is True


def test_keyword_match_is_case_insensitive():
    text = "EXPERIENCE\n" + "long enough text to clear the minimum length threshold " * 3
    ok, _ = looks_like_resume(text, page_count=1)
    assert ok is True

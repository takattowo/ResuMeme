import re

from shared.id_gen import generate_id


def test_generate_id_returns_url_safe_string():
    cv_id = generate_id()
    assert re.match(r"^[A-Za-z0-9_-]+$", cv_id)


def test_generate_id_is_at_least_8_chars():
    cv_id = generate_id()
    assert len(cv_id) >= 8


def test_generate_id_is_unique_across_calls():
    ids = {generate_id() for _ in range(1000)}
    assert len(ids) == 1000

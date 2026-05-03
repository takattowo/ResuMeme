import time

import pytest

from shared.rate_limiter import check, client_ip, record

CONN = "UseDevelopmentStorage=true"


@pytest.fixture(autouse=True)
def _fresh_ip():
    # Use a unique IP per test invocation so runs don't pollute each other.
    import uuid
    yield f"203.0.113.{uuid.uuid4().int % 255}"


def test_check_passes_first_time(_fresh_ip):
    ok, _, _ = check(CONN, _fresh_ip)
    assert ok is True


def test_record_then_check_blocks_within_window(_fresh_ip):
    record(CONN, _fresh_ip)
    ok, retry, reason = check(CONN, _fresh_ip)
    assert ok is False
    assert retry > 0
    assert reason == "window"


def test_unknown_ip_is_never_blocked():
    ok, _, _ = check(CONN, "unknown")
    assert ok is True
    record(CONN, "unknown")  # must not raise
    ok, _, _ = check(CONN, "")
    assert ok is True


def test_client_ip_extracts_first_forwarded_for():
    headers = {"x-forwarded-for": "198.51.100.5, 10.0.0.1, 10.0.0.2"}
    assert client_ip(headers) == "198.51.100.5"


def test_client_ip_unknown_when_missing():
    assert client_ip({}) == "unknown"


def test_client_ip_handles_uppercase_header():
    headers = {"X-Forwarded-For": "198.51.100.10"}
    assert client_ip(headers) == "198.51.100.10"

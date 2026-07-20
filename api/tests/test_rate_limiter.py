import time

import pytest
from azure.core.exceptions import ResourceNotFoundError

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


def test_unknown_ip_uses_shared_limit(monkeypatch):
    class MemoryTable:
        entities = {}

        def get_entity(self, partition, row):
            try:
                return self.entities[(partition, row)]
            except KeyError:
                raise ResourceNotFoundError()

        def upsert_entity(self, entity, **_kwargs):
            self.entities[(entity["PartitionKey"], entity["RowKey"])] = entity

    table = MemoryTable()
    monkeypatch.setattr("shared.rate_limiter._table", lambda _connection: table)
    record(CONN, "unknown")
    ok, _, reason = check(CONN, "")
    assert ok is False
    assert reason == "window"


def test_client_ip_uses_platform_socket_ip():
    headers = {
        "x-azure-socketip": "198.51.100.5",
        "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    }
    assert client_ip(headers) == "198.51.100.5"


def test_client_ip_unknown_when_missing():
    assert client_ip({}) == "unknown"


def test_client_ip_handles_uppercase_header():
    headers = {"X-Azure-SocketIP": "198.51.100.10"}
    assert client_ip(headers) == "198.51.100.10"


def test_client_ip_ignores_spoofable_forwarded_headers():
    headers = {"x-forwarded-for": "198.51.100.5", "x-azure-clientip": "198.51.100.6"}
    assert client_ip(headers) == "unknown"


def test_client_ip_rejects_invalid_address():
    assert client_ip({"x-azure-socketip": "not-an-ip"}) == "unknown"


def test_client_ip_normalizes_ipv6():
    assert client_ip({"x-azure-socketip": "2001:0db8::1"}) == "2001:db8::1"

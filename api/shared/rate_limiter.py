"""IP-based rate limiting backed by Azure Table Storage.

Two limits applied per request:
  1. WINDOW_SECONDS between consecutive uploads (default 30s).
  2. DAILY_CAP uploads per IP per UTC day (default 30).

Best-effort: a tight race between two concurrent requests from the same IP
might both pass the check. Acceptable for a meme site at our scale.
"""
import logging
from datetime import datetime, timedelta, timezone

from azure.core.exceptions import ResourceNotFoundError
from azure.data.tables import TableServiceClient, UpdateMode

WINDOW_SECONDS = 30
DAILY_CAP = 30
TABLE_NAME = "ratelimits"


def _table(connection_string: str):
    service = TableServiceClient.from_connection_string(connection_string)
    try:
        service.create_table(TABLE_NAME)
    except Exception:
        pass  # already exists is fine
    return service.get_table_client(TABLE_NAME)


def _safe_key(s: str) -> str:
    """Azure Table Storage keys forbid /, \\, #, ?, control chars."""
    return "".join(c if c.isalnum() or c in "._-:" else "_" for c in s)[:128]


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def check(connection_string: str, ip: str) -> tuple[bool, int, str]:
    """Returns (ok, retry_after_seconds, reason_if_blocked)."""
    if not ip or ip == "unknown":
        return True, 0, ""
    pk = _safe_key(ip)
    table = _table(connection_string)

    # 30s window check.
    try:
        last = table.get_entity(pk, "last")
        last_ts = datetime.fromisoformat(last.get("ts", ""))
        delta = (datetime.now(timezone.utc) - last_ts).total_seconds()
        if delta < WINDOW_SECONDS:
            return False, int(WINDOW_SECONDS - delta + 1), "window"
    except (ResourceNotFoundError, ValueError):
        pass
    except Exception:
        logging.exception("rate-limit window check failed; allowing")

    # Daily cap check.
    today_rk = "day_" + _today_utc()
    try:
        day = table.get_entity(pk, today_rk)
        count = int(day.get("count", 0))
        if count >= DAILY_CAP:
            return False, 60 * 60, "daily_cap"
    except (ResourceNotFoundError, ValueError):
        pass
    except Exception:
        logging.exception("rate-limit daily check failed; allowing")

    return True, 0, ""


def record(connection_string: str, ip: str) -> None:
    """Record an upload attempt. Best-effort; failures are logged and ignored."""
    if not ip or ip == "unknown":
        return
    pk = _safe_key(ip)
    table = _table(connection_string)
    now = datetime.now(timezone.utc)

    try:
        table.upsert_entity(
            {"PartitionKey": pk, "RowKey": "last", "ts": now.isoformat()},
            mode=UpdateMode.REPLACE,
        )
    except Exception:
        logging.exception("rate-limit window record failed")

    today_rk = "day_" + _today_utc()
    try:
        existing = table.get_entity(pk, today_rk)
        new_count = int(existing.get("count", 0)) + 1
    except ResourceNotFoundError:
        new_count = 1
    except Exception:
        logging.exception("rate-limit daily read failed; resetting to 1")
        new_count = 1

    try:
        table.upsert_entity(
            {"PartitionKey": pk, "RowKey": today_rk, "count": new_count},
            mode=UpdateMode.REPLACE,
        )
    except Exception:
        logging.exception("rate-limit daily record failed")


def client_ip(headers) -> str:
    """Extract client IP from forwarded headers (case-insensitive)."""
    if hasattr(headers, "get"):
        getter = headers.get
    else:
        return "unknown"
    candidates = [
        getter("x-forwarded-for"),
        getter("X-Forwarded-For"),
        getter("x-azure-clientip"),
        getter("X-Azure-ClientIP"),
        getter("x-original-forwarded-for"),
    ]
    for raw in candidates:
        if raw:
            first = raw.split(",")[0].strip()
            if first:
                return first
    return "unknown"

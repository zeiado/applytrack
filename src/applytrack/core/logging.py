"""Logging setup: request ids on every line, JSON in production, readable text locally."""

import json
import logging
import re
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any, Literal

# The id of the request being handled, or "-" outside a request. Each request runs in
# its own context, so concurrent requests never see each other's id.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# Ids we accept from callers. Anything else (too long, spaces, newlines that could
# forge extra log lines) is replaced with a fresh id.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Attributes every LogRecord has; anything else was passed with `extra=`.
_STANDARD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "request_id",
    "taskName",
}


def new_request_id() -> str:
    return uuid.uuid4().hex


def accept_request_id(incoming: str | None) -> str:
    """Reuse the caller's id if it's safe, so one id can follow a request across services."""
    if incoming and _VALID_REQUEST_ID.fullmatch(incoming):
        return incoming
    return new_request_id()


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line, ready for a log platform to index."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        entry.update({k: v for k, v in record.__dict__.items() if k not in _STANDARD_ATTRS})
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str, ensure_ascii=False)


TEXT_FORMAT = "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"


def configure_logging(
    *, level: str = "INFO", log_format: Literal["json", "text"] = "text"
) -> logging.Handler:
    """Send all logs to stdout in one format. Returns the handler (useful in tests)."""
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        JsonFormatter() if log_format == "json" else logging.Formatter(TEXT_FORMAT)
    )

    root = logging.getLogger()
    for existing in [h for h in root.handlers if getattr(h, "_applytrack", False)]:
        root.removeHandler(existing)
    handler._applytrack = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(level.upper())

    # We write our own access log line (with request id and duration), so silence uvicorn's.
    logging.getLogger("uvicorn.access").disabled = True
    return handler

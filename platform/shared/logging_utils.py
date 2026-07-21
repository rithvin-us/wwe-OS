"""Structured logging support.

`RequestContextFilter` stamps every log record with the current request id,
actor, and tenant (from the request context), so both the text and JSON
formats can correlate lines to requests. `JSONFormatter` renders records as
one JSON object per line for log aggregators; select it with LOG_FORMAT=json.
"""

from __future__ import annotations

import json
import logging

from shared import context

CONTEXT_ATTRS = ("request_id", "user_id", "tenant_id")
EXTRA_ATTRS = ("method", "path", "status", "duration_ms")


class RequestContextFilter(logging.Filter):
    """Attach request context to every record (defaults keep formats safe)."""

    def filter(self, record: logging.LogRecord) -> bool:
        ctx = context.get_context()
        if getattr(record, "request_id", None) in (None, ""):
            record.request_id = ctx.request_id or "-"
        user = ctx.user
        authenticated = user is not None and getattr(user, "is_authenticated", False)
        record.user_id = str(user.id) if authenticated else "-"
        record.tenant_id = str(ctx.tenant_id) if ctx.tenant_id else "-"
        return True


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for attr in (*CONTEXT_ATTRS, *EXTRA_ATTRS):
            value = getattr(record, attr, None)
            if value is not None and value != "-":
                payload[attr] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)

"""Request-scoped context and observability middleware.

`RequestContextMiddleware` captures the actor and request metadata (IP, user
agent) into the thread-local context so services and audit can read them, and
clears context after each request. `ObservabilityMiddleware` (innermost, so
the log line carries whatever tenant/actor auth resolved) assigns a request
id, emits one access-log line per request, and records request metrics.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from shared import context, metrics

request_logger = logging.getLogger("platform.requests")

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

# Probe/scrape endpoints hit every few seconds — logging and counting them
# would drown real traffic in noise.
QUIET_PATHS = frozenset({"/healthz", "/readyz", "/metrics"})


def _client_ip(request: HttpRequest) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class RequestContextMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        context.clear_context()
        context.set_context(
            user=getattr(request, "user", None),
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
        )
        try:
            return self.get_response(request)
        finally:
            context.clear_context()


class ObservabilityMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        supplied = (request.headers.get("X-Request-ID") or "").strip()
        request_id = supplied if _REQUEST_ID_RE.match(supplied) else uuid.uuid4().hex
        context.set_context(request_id=request_id)
        request.request_id = request_id

        started = time.perf_counter()
        status_code = 500  # assume the worst; overwritten on a real response
        try:
            response = self.get_response(request)
            status_code = response.status_code
            response["X-Request-ID"] = request_id
            return response
        finally:
            if request.path not in QUIET_PATHS:
                duration_ms = round((time.perf_counter() - started) * 1000, 1)
                metrics.record_request(request.method, status_code, duration_ms)
                slow_ms = getattr(settings, "SLOW_REQUEST_MS", 1000)
                level = (
                    logging.WARNING
                    if status_code >= 500 or duration_ms >= slow_ms
                    else logging.INFO
                )
                request_logger.log(
                    level,
                    "%s %s -> %s in %sms",
                    request.method,
                    request.path,
                    status_code,
                    duration_ms,
                    extra={
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.path,
                        "status": status_code,
                        "duration_ms": duration_ms,
                    },
                )

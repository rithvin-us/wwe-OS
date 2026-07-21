"""Lightweight request metrics stored in the shared cache.

With Redis behind the cache these counters aggregate across all gunicorn
workers; under locmem (local dev) they are per-process. Deliberately tiny —
counts by method/status class plus a total-duration pair — so the exposition
endpoint needs no extra dependency and no unbounded label cardinality.
"""

from __future__ import annotations

import contextlib

from django.core.cache import cache

PREFIX = "metrics:"
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "OTHER")
STATUS_CLASSES = ("1xx", "2xx", "3xx", "4xx", "5xx")


def record_request(method: str, status_code: int, duration_ms: float) -> None:
    method = method.upper()
    if method not in METHODS:
        method = "OTHER"
    status_class = f"{status_code // 100}xx"
    if status_class not in STATUS_CLASSES:
        status_class = "5xx"
    _incr(f"requests:{method}:{status_class}")
    _incr("duration_ms_sum", int(duration_ms))
    _incr("duration_ms_count")


def _incr(key: str, delta: int = 1) -> None:
    full = PREFIX + key
    try:
        cache.incr(full, delta)
    except ValueError:  # key does not exist yet
        if not cache.add(full, delta, timeout=None):
            with contextlib.suppress(ValueError):
                cache.incr(full, delta)


def prometheus_text() -> str:
    """Render current counters in Prometheus exposition format."""
    lines = ["# TYPE wweos_requests_total counter"]
    keys = [f"{PREFIX}requests:{m}:{c}" for m in METHODS for c in STATUS_CLASSES]
    for key, value in sorted(cache.get_many(keys).items()):
        _, _, method, status_class = key.split(":")
        lines.append(f'wweos_requests_total{{method="{method}",status="{status_class}"}} {value}')
    lines.append("# TYPE wweos_request_duration_ms_sum counter")
    lines.append(f"wweos_request_duration_ms_sum {cache.get(PREFIX + 'duration_ms_sum') or 0}")
    lines.append("# TYPE wweos_request_duration_ms_count counter")
    lines.append(f"wweos_request_duration_ms_count {cache.get(PREFIX + 'duration_ms_count') or 0}")
    return "\n".join(lines) + "\n"

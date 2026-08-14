"""Notification buckets — the four operator-facing categories the Notification
Center groups by: critical, action required, informational, completed.

The platform already stores a real `priority` on every notification, so the
bucket is derived deterministically from it rather than invented:

    urgent  → critical          (something is wrong / needs attention now)
    high    → action_required   (the operator has to do something)
    normal  → informational     (FYI, no action)
    low     → completed          (a confirmation that something finished)

A publishing module that knows better can be explicit by putting a `kind` in
the notification's `data` (one of the four bucket names); that override wins.
Nothing here fabricates a classification — every notification carries a
priority, and the mapping is a fixed, documented table.
"""

from __future__ import annotations

CRITICAL = "critical"
ACTION_REQUIRED = "action_required"
INFORMATIONAL = "informational"
COMPLETED = "completed"

BUCKETS = (CRITICAL, ACTION_REQUIRED, INFORMATIONAL, COMPLETED)

_PRIORITY_BUCKET = {
    "urgent": CRITICAL,
    "high": ACTION_REQUIRED,
    "normal": INFORMATIONAL,
    "low": COMPLETED,
}


def bucket_for(*, priority: str, data: dict | None = None) -> str:
    """Return the operator-facing bucket for a notification. An explicit
    `data["kind"]` (one of BUCKETS) overrides the priority mapping."""
    kind = (data or {}).get("kind")
    if isinstance(kind, str) and kind in BUCKETS:
        return kind
    return _PRIORITY_BUCKET.get(priority, INFORMATIONAL)

"""In-process platform event bus.

The single channel for cross-capability reactions. Capabilities publish events;
others subscribe. Future modules subscribe the same way and never call each
other directly. Dispatch is synchronous now; the contract allows an async
(Celery/Redis) transport later without changing publishers or subscribers.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("platform.events")

EventHandler = Callable[..., None]

_subscribers: dict[str, list[EventHandler]] = defaultdict(list)


class Events:
    """Canonical platform event names."""

    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_LOGGED_IN = "user.logged_in"
    USER_LOGGED_OUT = "user.logged_out"
    PASSWORD_CHANGED = "user.password_changed"
    ROLE_CREATED = "role.created"
    ROLE_CHANGED = "role.changed"
    ROLE_ASSIGNED = "role.assigned"
    PERMISSION_ASSIGNED = "permission.assigned"
    TENANT_CREATED = "tenant.created"
    NOTIFICATION_CREATED = "notification.created"
    AUDIT_RECORDED = "audit.recorded"
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_STEP_APPROVED = "workflow.step_approved"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_REJECTED = "workflow.rejected"
    WORKFLOW_CANCELLED = "workflow.cancelled"
    FILE_STORED = "storage.file_stored"
    FILE_DELETED = "storage.file_deleted"
    REPORT_EXPORTED = "reporting.exported"
    SEARCH_REINDEXED = "search.reindexed"


def subscribe(event: str, handler: EventHandler) -> None:
    if handler not in _subscribers[event]:
        _subscribers[event].append(handler)


def unsubscribe(event: str, handler: EventHandler) -> None:
    if handler in _subscribers.get(event, []):
        _subscribers[event].remove(handler)


def publish(event: str, **payload: Any) -> None:
    """Notify subscribers. A failing subscriber never breaks the publisher."""
    for handler in list(_subscribers.get(event, [])):
        try:
            handler(event=event, **payload)
        except Exception:  # noqa: BLE001 - one bad subscriber must not cascade
            logger.exception("Event subscriber failed for %s", event)


def clear() -> None:
    """Test helper — drop all subscriptions."""
    _subscribers.clear()

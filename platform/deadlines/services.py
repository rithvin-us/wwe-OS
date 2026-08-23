"""Deadline engine — one permission-aware, tenant-scoped view of every
date-sensitive record across the platform (invoice due dates, contract expiry,
and whatever else registers a source).

The engine owns aggregation, permission filtering and ordering; each module
owns how one of its records becomes a `Deadline`. A `notify_due` pass turns the
imminent ones into notifications through the existing notification system,
addressed to a recipient the caller picks (the single operator today).
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from shared.services import BaseService

from deadlines import registry

DEFAULT_HORIZON_DAYS = 30


class DeadlineService(BaseService):
    def upcoming(self, *, user, within_days: int = DEFAULT_HORIZON_DAYS) -> list[dict[str, Any]]:
        """Every deadline due within `within_days` (plus anything already
        overdue), across the sources this user may see, soonest first."""
        tenant = None if getattr(user, "is_superuser", False) else getattr(user, "tenant", None)
        results: list[dict[str, Any]] = []
        for source in registry.all_sources():
            if not self._may_see(user, source.permission):
                continue
            for deadline in source.upcoming(tenant, within_days):
                results.append(asdict(deadline))
        results.sort(key=lambda d: d["due_date"])
        return results

    def notify_due(self, *, recipient, within_days: int = 7) -> int:
        """Create an in-app notification for each deadline due within
        `within_days` for the recipient's tenant. Idempotency is the caller's
        concern (run it on a schedule); returns how many were sent."""
        from notifications.services import NotificationService

        service = NotificationService()
        sent = 0
        for deadline in self.upcoming(user=recipient, within_days=within_days):
            priority = "urgent" if deadline["is_overdue"] else "high"
            service.create(
                recipient=recipient,
                title=deadline["label"],
                body=self._describe(deadline),
                category=deadline["kind"],
                priority=priority,
                data={"url": deadline["url"], "object_id": deadline["object_id"]},
            )
            sent += 1
        return sent

    @staticmethod
    def _may_see(user, permission: str) -> bool:
        if getattr(user, "is_superuser", False):
            return True
        return user.has_platform_permission(permission)

    @staticmethod
    def _describe(deadline: dict[str, Any]) -> str:
        if deadline["is_overdue"]:
            return f"Overdue by {abs(deadline['days_remaining'])} day(s)."
        return f"Due in {deadline['days_remaining']} day(s)."

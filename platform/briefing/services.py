"""Management Briefing — "what changed in my company?"

Answers with meaningful movements, not decorative charts, assembled from data
that already exists: the immutable audit trail (the record of everything that
happened), plus the platform aggregators for what needs attention now
(approvals waiting, deadlines due/overdue). Every number is real and traces
back to records; nothing is invented.

Platform-appropriate by construction — it reads the audit log (a platform
capability) and the deadline/approval services (platform aggregators), never a
business module's models directly.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import models
from django.utils import timezone
from shared.services import BaseService

DEFAULT_WINDOW_DAYS = 7
TOP_ACTIVITY = 8
HIGHLIGHTS = 10


class BriefingService(BaseService):
    def summary(self, *, user, days: int = DEFAULT_WINDOW_DAYS) -> dict[str, Any]:
        since = timezone.now() - timedelta(days=days)
        entries = self._audit_since(user, since)

        return {
            "window_days": days,
            "activity": self._activity(entries),
            "highlights": self._highlights(entries),
            "attention": self._attention(user, days),
        }

    # ------------------------------------------------------------------ #
    @staticmethod
    def _audit_since(user, since):
        from audit.models import AuditLog

        qs = AuditLog.objects.filter(archived=False, created_at__gte=since)
        if not getattr(user, "is_superuser", False):
            qs = qs.filter(tenant_id=getattr(user, "tenant_id", None))
        return qs

    @staticmethod
    def _activity(entries) -> list[dict[str, Any]]:
        """Counts per (module, action) over the window — 'what happened, and how
        much of it', most-active first."""
        rows = (
            entries.values("module", "action")
            .annotate(count=models.Count("id"))
            .order_by("-count")[:TOP_ACTIVITY]
        )
        return [
            {"module": row["module"], "action": row["action"], "count": row["count"]}
            for row in rows
        ]

    @staticmethod
    def _highlights(entries) -> list[dict[str, Any]]:
        """The most recent notable events, each tracing back to its record."""
        return [
            {
                "action": entry.action,
                "module": entry.module,
                "object_type": entry.object_type,
                "object_id": entry.object_id,
                "at": entry.created_at,
                "changes": entry.changes,
            }
            for entry in entries.order_by("-created_at")[:HIGHLIGHTS]
        ]

    @staticmethod
    def _attention(user, days: int) -> dict[str, int]:
        from approvals.services import ApprovalService
        from deadlines.services import DeadlineService

        deadlines = DeadlineService().upcoming(user=user, within_days=days)
        return {
            "pending_approvals": len(ApprovalService().pending(user=user)),
            "overdue": sum(1 for d in deadlines if d["is_overdue"]),
            "due_soon": sum(1 for d in deadlines if not d["is_overdue"]),
        }

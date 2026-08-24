"""Workspace cockpit — one answer to "what needs me, and what changed?"

The single-operator company is run from here, so this assembles the whole
cockpit in ONE pass instead of each surface re-aggregating the same sources:

- `worklist`: every open item that needs the operator — pending approvals and
  due/overdue deadlines — interleaved into one list ranked by urgency, each
  carrying enough to act on in place (approvals are `actionable`).
- `counts`: the headline tallies (waiting / overdue / due soon), derived from
  the same worklist so a number can never disagree with the list under it.
- `digest`: the secondary "what changed" view — activity counts and recent
  highlights from the immutable audit trail.

Platform-appropriate by construction: it reads the audit log (a platform
capability) and the approval/deadline aggregators (platform services), never a
business module's models directly. Ranking policy lives in `_score` and is the
one place to change how the day is prioritised.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.db import models
from django.utils import timezone
from shared.services import BaseService

DEFAULT_WINDOW_DAYS = 7
WORKLIST_HORIZON_DAYS = 30
TOP_ACTIVITY = 8
HIGHLIGHTS = 10

# Ranking tiers (higher shows first). The policy: an overdue commitment is a
# crisis; a person blocked on your approval comes next; then what falls due
# today, then what is merely upcoming. Within a tier, age/closeness breaks ties.
_TIER_OVERDUE = 4000
_TIER_APPROVAL = 3000
_TIER_TODAY = 2000
_TIER_SOON = 1000
_PRIORITY_WEIGHT = {"urgent": 300, "high": 200, "normal": 100, "low": 0}


class BriefingService(BaseService):
    def summary(self, *, user, days: int = DEFAULT_WINDOW_DAYS) -> dict[str, Any]:
        worklist = self._worklist(user)
        entries = self._audit_since(user, timezone.now() - timedelta(days=days))
        return {
            "window_days": days,
            "counts": self._counts(worklist),
            "worklist": worklist,
            "digest": {
                "activity": self._activity(entries),
                "highlights": self._highlights(entries),
            },
        }

    # ------------------------------------------------------------------ #
    # Worklist — the unified, ranked "what needs me" list.
    # ------------------------------------------------------------------ #
    def _worklist(self, user) -> list[dict[str, Any]]:
        from approvals.services import ApprovalService
        from deadlines.services import DeadlineService

        items = [self._from_approval(a) for a in ApprovalService().pending(user=user)]
        items += [
            self._from_deadline(d)
            for d in DeadlineService().upcoming(user=user, within_days=WORKLIST_HORIZON_DAYS)
        ]
        items.sort(key=lambda item: item.pop("_score"), reverse=True)
        return items

    @classmethod
    def _from_approval(cls, approval: dict[str, Any]) -> dict[str, Any]:
        waiting = cls._days_since(approval.get("submitted_at"))
        priority = approval.get("priority") or "normal"
        return {
            "source": "approval",
            "kind": approval["kind"],
            "label": approval.get("label", approval["kind"]),
            "title": approval["title"],
            "subtitle": approval.get("requester", ""),
            "timing": f"Waiting {waiting}d" if waiting else "Waiting",
            "urgency": "waiting",
            "actionable": True,
            "url": approval.get("url", ""),
            "object_id": approval["object_id"],
            "extra": approval.get("extra", {}),
            "_score": _TIER_APPROVAL + _PRIORITY_WEIGHT.get(priority, 100) + min(waiting, 999),
        }

    @classmethod
    def _from_deadline(cls, deadline: dict[str, Any]) -> dict[str, Any]:
        remaining = deadline["days_remaining"]
        if deadline["is_overdue"]:
            urgency = "overdue"
            timing = f"Overdue by {abs(remaining)}d"
            score = _TIER_OVERDUE + abs(remaining)
        elif remaining == 0:
            urgency, timing, score = "today", "Due today", _TIER_TODAY
        else:
            urgency = "soon"
            timing = f"Due in {remaining}d"
            score = _TIER_SOON + (WORKLIST_HORIZON_DAYS - remaining)
        return {
            "source": "deadline",
            "kind": deadline["kind"],
            "label": deadline.get("label", deadline["kind"]),
            "title": deadline.get("label", deadline["kind"]),
            "subtitle": "",
            "timing": timing,
            "urgency": urgency,
            "actionable": False,
            "url": deadline.get("url", ""),
            "object_id": deadline["object_id"],
            "extra": deadline.get("extra", {}),
            "_score": score,
        }

    @staticmethod
    def _counts(worklist: list[dict[str, Any]]) -> dict[str, int]:
        return {
            "waiting": sum(1 for i in worklist if i["urgency"] == "waiting"),
            "overdue": sum(1 for i in worklist if i["urgency"] == "overdue"),
            "due_soon": sum(1 for i in worklist if i["urgency"] in ("today", "soon")),
        }

    @staticmethod
    def _days_since(when: datetime | None) -> int:
        if when is None:
            return 0
        return max((timezone.now() - when).days, 0)

    # ------------------------------------------------------------------ #
    # Digest — the secondary "what changed" view.
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

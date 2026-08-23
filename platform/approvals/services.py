"""Approval Center — one inbox for every pending human decision across the
platform (leave, expenses, and whatever else registers a source).

The centre owns aggregation, permission enforcement and routing a decision back
to the module that owns it; each module owns what a pending item looks like and
what approving/rejecting it actually does. No decision logic is duplicated here
— `decide` just calls back into the registered source.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from shared.exceptions import PermissionDeniedError, ValidationError
from shared.services import BaseService

from approvals import registry


class ApprovalService(BaseService):
    def pending(self, *, user) -> list[dict[str, Any]]:
        """Every pending approval across the sources this user may view,
        oldest first (longest-waiting at the top)."""
        tenant = None if getattr(user, "is_superuser", False) else getattr(user, "tenant", None)
        results: list[dict[str, Any]] = []
        for source in registry.all_sources():
            if not self._may(user, source.view_permission):
                continue
            for approval in source.pending(tenant):
                row = asdict(approval)
                row["label"] = source.label
                results.append(row)
        results.sort(key=lambda a: (a["submitted_at"] is None, a["submitted_at"]))
        return results

    def decide(self, *, user, kind: str, object_id: str, approve: bool, note: str = "") -> None:
        source = registry.get(kind)
        if not self._may(user, source.decide_permission):
            raise PermissionDeniedError("You do not have permission to decide this approval.")
        if not approve and not note.strip():
            raise ValidationError(detail={"note": ["A reason is required to reject."]})
        source.decide(object_id, approve=approve, actor=user, note=note.strip())

    @staticmethod
    def _may(user, permission: str) -> bool:
        if getattr(user, "is_superuser", False):
            return True
        return user.has_platform_permission(permission)

"""Wires workflow events into the audit trail.

Imported once from WorkflowConfig.ready(). Same pattern as the purchase
module's subscribers: react through the audit service's public surface only.
"""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    changes = {}
    if instance is not None:
        changes = {
            "definition": instance.definition.key,
            "subject_type": instance.subject_type,
            "subject_id": instance.subject_id,
            "status": instance.status,
        }
    AuditService().record(
        action=event,
        module="workflow",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes=changes,
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


for _event in (
    Events.WORKFLOW_STARTED,
    Events.WORKFLOW_STEP_APPROVED,
    Events.WORKFLOW_COMPLETED,
    Events.WORKFLOW_REJECTED,
    Events.WORKFLOW_CANCELLED,
):
    subscribe(_event, _record_audit)

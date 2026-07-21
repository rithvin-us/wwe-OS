"""Wires reporting events into the audit trail."""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="reporting",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "report_key": getattr(instance, "report_key", ""),
            "format": getattr(instance, "format", ""),
            "row_count": getattr(instance, "row_count", 0),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


subscribe(Events.REPORT_EXPORTED, _record_audit)

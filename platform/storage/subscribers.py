"""Wires storage events into the audit trail."""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="storage",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "filename": getattr(instance, "filename", ""),
            "module": getattr(instance, "module", ""),
            "size_bytes": getattr(instance, "size_bytes", 0),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


for _event in (Events.FILE_STORED, Events.FILE_DELETED):
    subscribe(_event, _record_audit)

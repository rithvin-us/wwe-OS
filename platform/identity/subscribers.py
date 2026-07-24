"""Wires identity events into the audit trail — same pattern as
storage/subscribers.py."""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="identity",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "channel": getattr(instance, "channel", ""),
            "external_id": getattr(instance, "external_id", ""),
            "mapped_object_type": getattr(instance, "mapped_object_type", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


for _event in (Events.IDENTITY_RESOLVED, Events.IDENTITY_MAPPED):
    subscribe(_event, _record_audit)

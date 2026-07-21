"""Wires asset events into the audit trail."""

from __future__ import annotations

from typing import Any

from assets.backend.events.registry import ALL_EVENTS
from shared.events import subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="assets",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "asset_tag": getattr(instance, "asset_tag", ""),
            "name": getattr(instance, "name", ""),
            "status": getattr(instance, "status", ""),
            "assigned_to": getattr(instance, "assigned_to", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)

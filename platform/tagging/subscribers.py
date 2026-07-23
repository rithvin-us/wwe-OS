"""Wires tagging events into the audit trail."""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe


def _record_audit(
    event: str, instance: Any = None, actor: Any = None, changes: dict | None = None, **_extra: Any
) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="tagging",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes=changes or {"name": getattr(instance, "name", "")},
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


for _event in (Events.TAG_CREATED, Events.TAG_DELETED, Events.TAG_ATTACHED, Events.TAG_DETACHED):
    subscribe(_event, _record_audit)

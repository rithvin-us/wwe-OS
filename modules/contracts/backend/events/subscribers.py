"""Wires contract events into the audit trail, and reacts to platform workflow
completion to advance the contract. Both through public platform surfaces only.
"""

from __future__ import annotations

from typing import Any

from contracts.backend.events.registry import ALL_EVENTS
from shared.events import subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="contracts",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "title": getattr(instance, "title", ""),
            "counterparty": getattr(instance, "counterparty", ""),
            "status": getattr(instance, "status", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)

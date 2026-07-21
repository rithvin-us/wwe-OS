"""Wires document events into platform capabilities.

Two directions, both through public platform surfaces only:
- Module events (documents.*) → the audit trail.
- Platform workflow events (workflow.completed / workflow.rejected) → advance
  the document whose approval just finished. This is how the module reacts to
  the platform workflow engine without the engine ever knowing what a Document
  is.
"""

from __future__ import annotations

from typing import Any

from documents.backend.events.registry import ALL_EVENTS
from shared.events import subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="documents",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "title": getattr(instance, "title", ""),
            "status": getattr(instance, "status", ""),
            "category": getattr(instance, "category", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)

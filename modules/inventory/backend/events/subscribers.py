"""Wires inventory events into the audit trail."""

from __future__ import annotations

from typing import Any

from inventory.backend.events.registry import ALL_EVENTS
from shared.events import subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    changes: dict[str, Any] = {}
    if instance is not None:
        # instance is an InventoryItem for item/low-stock events, a
        # StockMovement for stock_moved — record the useful fields of each.
        for field in ("sku", "name", "quantity_on_hand", "movement_type", "delta", "balance_after"):
            value = getattr(instance, field, None)
            if value is not None:
                changes[field] = str(value)

    AuditService().record(
        action=event,
        module="inventory",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes=changes,
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)

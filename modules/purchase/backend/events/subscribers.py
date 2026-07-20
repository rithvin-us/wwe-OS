"""Wires purchase events into platform capabilities (audit).

Imported once from PurchaseConfig.ready(). Each handler calls the platform's
own service — this module never touches audit's internals, only its public
service surface, exactly as any other caller would.
"""

from __future__ import annotations

from typing import Any

from shared.events import subscribe

from purchase.backend.events.registry import (
    PURCHASE_BILL_CONFIRMED,
    PURCHASE_BILL_INGESTED,
    PURCHASE_BILL_PAID,
    PURCHASE_BILL_REJECTED,
)


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="purchase",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        actor=actor,
    )


for _event in (
    PURCHASE_BILL_INGESTED,
    PURCHASE_BILL_CONFIRMED,
    PURCHASE_BILL_REJECTED,
    PURCHASE_BILL_PAID,
):
    subscribe(_event, _record_audit)

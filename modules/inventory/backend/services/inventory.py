"""Inventory business logic.

The one rule that matters: on-hand quantity and its ledger row change together,
atomically, under a row lock — so concurrent receipts/issues can never corrupt
the balance. Everything else (search re-index, low-stock notification, audit
events) reuses platform capabilities; this module reimplements none of them.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db import IntegrityError, transaction
from inventory.backend.events.registry import (
    ITEM_CREATED,
    ITEM_UPDATED,
    STOCK_MOVED,
)
from inventory.backend.models import InventoryItem, MovementType, StockMovement
from inventory.backend.repositories.inventory import InventoryRepository
from inventory.backend.search.adapter import INDEX, to_document
from search.services import SearchService
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService


class InventoryService(BaseService):
    def __init__(self) -> None:
        super().__init__()
        self.repo = InventoryRepository()

    # ------------------------------------------------------------------ #
    # Items
    # ------------------------------------------------------------------ #
    def create_item(self, *, tenant, actor, data: dict[str, Any]) -> InventoryItem:
        try:
            item = InventoryItem.objects.create(tenant=tenant, **data)
        except IntegrityError as exc:
            raise ConflictError("An item with this SKU already exists.") from exc
        publish(ITEM_CREATED, instance=item, actor=actor)
        self._index(item)
        return item

    def update_item(self, *, item: InventoryItem, actor, data: dict[str, Any]) -> InventoryItem:
        # Quantity is never edited directly — it only moves via record_movement.
        data.pop("quantity_on_hand", None)
        fields: list[str] = []
        for field, value in data.items():
            if getattr(item, field) != value:
                setattr(item, field, value)
                fields.append(field)
        if fields:
            try:
                item.save(update_fields=[*fields, "updated_at"])
            except IntegrityError as exc:
                raise ConflictError("An item with this SKU already exists.") from exc
            publish(ITEM_UPDATED, instance=item, actor=actor)
            self._index(item)
        return item

    def deactivate_item(self, *, item: InventoryItem, actor) -> InventoryItem:
        item.is_active = False
        item.save(update_fields=["is_active", "updated_at"])
        publish(ITEM_UPDATED, instance=item, actor=actor)
        SearchService().remove(index=INDEX, doc_id=str(item.id), tenant=item.tenant)
        return item

    def delete_item(self, *, item: InventoryItem, actor) -> None:
        if item.movements.exists():
            raise ConflictError(
                "This item has stock history and cannot be deleted. Deactivate it instead."
            )
        SearchService().remove(index=INDEX, doc_id=str(item.id), tenant=item.tenant)
        item.delete()

    # ------------------------------------------------------------------ #
    # Stock movements — the ledger
    # ------------------------------------------------------------------ #
    def record_movement(
        self,
        *,
        item: InventoryItem,
        movement_type: str,
        quantity: Decimal,
        actor,
        reason: str = "",
        reference: str = "",
    ) -> StockMovement:
        """Apply a stock change and record it, atomically under a row lock.

        receipt/issue take a positive magnitude; adjustment takes a signed
        delta. Stock can never go negative.
        """
        delta = self._delta_for(movement_type, quantity)
        with transaction.atomic():
            locked = InventoryItem.objects.select_for_update().get(pk=item.pk)
            if not locked.is_active:
                raise ConflictError("This item is inactive.")
            new_balance = locked.quantity_on_hand + delta
            if new_balance < 0:
                raise ConflictError(
                    f"Not enough stock: on hand {locked.quantity_on_hand}, change {delta}."
                )
            locked.quantity_on_hand = new_balance
            locked.save(update_fields=["quantity_on_hand", "updated_at"])
            movement = StockMovement.objects.create(
                tenant=locked.tenant,
                item=locked,
                movement_type=movement_type,
                delta=delta,
                balance_after=new_balance,
                reason=reason.strip(),
                reference=reference.strip(),
                actor=actor,
            )

        publish(STOCK_MOVED, instance=movement, actor=actor, item=locked)
        self._index(locked)
        return movement

    @staticmethod
    def _delta_for(movement_type: str, quantity: Decimal) -> Decimal:
        if movement_type == MovementType.RECEIPT:
            if quantity <= 0:
                raise ValidationError(detail={"quantity": ["Receipt quantity must be positive."]})
            return quantity
        if movement_type == MovementType.ISSUE:
            if quantity <= 0:
                raise ValidationError(detail={"quantity": ["Issue quantity must be positive."]})
            return -quantity
        if movement_type == MovementType.ADJUSTMENT:
            if quantity == 0:
                raise ValidationError(detail={"quantity": ["Adjustment cannot be zero."]})
            return quantity  # signed
        raise ValidationError(detail={"movement_type": ["Unknown movement type."]})

    # ------------------------------------------------------------------ #
    # Reporting
    # ------------------------------------------------------------------ #
    def build_report_spec(self, *, items, filters: dict | None = None) -> Any:
        from reporting.filtering import filters_summary
        from reporting.spec import ReportColumn, ReportSpec

        rows = [
            {
                "sku": item.sku,
                "name": item.name,
                "on_hand": f"{item.quantity_on_hand} {item.unit}",
                "value": (
                    f"{item.currency} {item.stock_value}" if item.stock_value is not None else "—"
                ),
            }
            for item in items
        ]
        return ReportSpec(
            key="inventory-stock",
            title="Stock on hand",
            module="inventory",
            columns=[
                ReportColumn("sku", "SKU"),
                ReportColumn("name", "Item"),
                ReportColumn("on_hand", "On hand", align="right"),
                ReportColumn("value", "Value", align="right"),
            ],
            rows=rows,
            filters=filters_summary(filters or {}, vendor_label="Supplier"),
        )

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _index(self, item: InventoryItem) -> None:
        if not item.is_active:
            return
        SearchService().upsert(index=INDEX, tenant=item.tenant, **to_document(item))

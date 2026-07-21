"""Inventory data access — thin; names the low-stock query."""

from __future__ import annotations

from django.db import models
from inventory.backend.models import InventoryItem


class InventoryRepository:
    def for_tenant(self, tenant) -> models.QuerySet[InventoryItem]:
        return InventoryItem.objects.filter(tenant=tenant)

    def get(self, *, item_id, tenant) -> InventoryItem | None:
        return InventoryItem.objects.filter(id=item_id, tenant=tenant).first()

    def low_stock(self, tenant) -> models.QuerySet[InventoryItem]:
        # reorder_level > 0 AND quantity_on_hand <= reorder_level, active only.
        return self.for_tenant(tenant).filter(
            is_active=True,
            reorder_level__gt=0,
            quantity_on_hand__lte=models.F("reorder_level"),
        )

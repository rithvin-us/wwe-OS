"""Inventory data access — thin; names the low-stock query."""

from __future__ import annotations

from django.db import models
from inventory.backend.models import InventoryItem


class InventoryRepository:
    def for_tenant(self, tenant) -> models.QuerySet[InventoryItem]:
        return InventoryItem.objects.filter(tenant=tenant)

    def get(self, *, item_id, tenant) -> InventoryItem | None:
        return InventoryItem.objects.filter(id=item_id, tenant=tenant).first()

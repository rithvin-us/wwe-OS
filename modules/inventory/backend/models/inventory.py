"""Inventory items and their stock-movement ledger.

An `InventoryItem` holds the current on-hand quantity; every change to it is a
`StockMovement` row (an append-only ledger — movements are never edited, only
added). Quantity is a decimal so units like kg/litres work, not just whole
pieces. Suppliers are free text: there is no Vendors module and modules never
import one another.

This module reuses the platform's search, reporting, notification, and audit
capabilities. It has no genuine need for storage, AI, or the workflow engine in
v1, so it does not use them (see docs/modules/inventory.md) rather than wiring
them in for show.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class MovementType(models.TextChoices):
    RECEIPT = "receipt", "Goods receipt"
    ISSUE = "issue", "Issue / consumption"
    ADJUSTMENT = "adjustment", "Adjustment"


class InventoryItem(TenantOwnedModel):
    name = models.CharField(max_length=200)
    sku = models.CharField(
        max_length=60, help_text="Stock-keeping unit — unique within the company."
    )
    category = models.CharField(max_length=60, blank=True, default="")
    unit = models.CharField(max_length=20, default="unit", help_text="e.g. pcs, kg, litre, box.")

    quantity_on_hand = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")

    location = models.CharField(max_length=120, blank=True, default="")
    supplier = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "inventory_item"
        indexes = [
            models.Index(fields=["tenant", "is_active"]),
            models.Index(fields=["tenant", "category"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "sku"], name="uniq_item_sku_per_tenant"),
        ]

    def __str__(self) -> str:
        return f"{self.sku} · {self.name}"

    @property
    def is_low_stock(self) -> bool:
        return (
            self.is_active
            and self.reorder_level > 0
            and self.quantity_on_hand <= self.reorder_level
        )

    @property
    def stock_value(self):
        if self.unit_cost is None:
            return None
        return (self.quantity_on_hand * self.unit_cost).quantize(self.unit_cost)


class StockMovement(TenantOwnedModel):
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    # Signed change applied to on-hand (receipt > 0, issue < 0, adjustment either).
    delta = models.DecimalField(max_digits=14, decimal_places=2)
    balance_after = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True, default="")
    reference = models.CharField(max_length=120, blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "inventory_movement"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["tenant", "item"])]

    def __str__(self) -> str:
        return f"{self.movement_type} {self.delta} → {self.item_id}"

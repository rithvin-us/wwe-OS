"""Company assets and their maintenance history.

An `Asset` moves through a small lifecycle (in stock → assigned → in
maintenance → disposed); each completed service is a `MaintenanceRecord`.
Assignees are a plain name (there is no Employees module and modules never
import one another). The optional warranty/invoice file lives in platform
storage. This module reuses storage, search, reporting, notifications, and
audit; it has no genuine need for AI or the workflow engine in v1, so it does
not wire them in (see docs/modules/assets.md).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class AssetCategory(models.TextChoices):
    IT_EQUIPMENT = "it_equipment", "IT equipment"
    FURNITURE = "furniture", "Furniture"
    VEHICLE = "vehicle", "Vehicle"
    MACHINERY = "machinery", "Machinery"
    TOOL = "tool", "Tool"
    OTHER = "other", "Other"


class AssetStatus(models.TextChoices):
    IN_STOCK = "in_stock", "In stock"
    ASSIGNED = "assigned", "Assigned"
    IN_MAINTENANCE = "in_maintenance", "In maintenance"
    DISPOSED = "disposed", "Disposed"


class Asset(TenantOwnedModel):
    name = models.CharField(max_length=200)
    asset_tag = models.CharField(max_length=60, help_text="Unique tag/label within the company.")
    category = models.CharField(
        max_length=20, choices=AssetCategory.choices, default=AssetCategory.OTHER, db_index=True
    )
    status = models.CharField(
        max_length=20, choices=AssetStatus.choices, default=AssetStatus.IN_STOCK, db_index=True
    )

    serial_number = models.CharField(max_length=120, blank=True, default="")
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    supplier = models.CharField(max_length=200, blank=True, default="")
    location = models.CharField(max_length=120, blank=True, default="")

    assigned_to = models.CharField(max_length=200, blank=True, default="")
    assigned_at = models.DateTimeField(null=True, blank=True)

    file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )

    disposed_at = models.DateTimeField(null=True, blank=True)
    disposal_reason = models.CharField(max_length=300, blank=True, default="")
    disposal_proceeds = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    notes = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "assets_asset"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "category"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "asset_tag"], name="uniq_asset_tag_per_tenant"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.asset_tag} · {self.name}"


class MaintenanceRecord(TenantOwnedModel):
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="maintenance")
    performed_on = models.DateField()
    description = models.CharField(max_length=300)
    cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    vendor = models.CharField(max_length=200, blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asset_maintenance",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "assets_maintenance"
        ordering = ("-performed_on", "-created_at")
        indexes = [models.Index(fields=["tenant", "asset"])]

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.description[:40]}"

"""Delivery Challan (DC) generation and history.

A Delivery Challan documents the movement of assets to a specific Site.
DCs can be Returnable (assets expected back) or Non-returnable (assets left at site permanently).
The system generates a PDF from an uploaded Word template for each DC and retains the history.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class Site(TenantOwnedModel):
    """A registered location/site where assets can be delivered."""

    name = models.CharField(max_length=200)
    address = models.TextField(blank=True, default="")
    contact_person = models.CharField(max_length=200, blank=True, default="")
    contact_phone = models.CharField(max_length=60, blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "assets_site"
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class ChallanType(models.TextChoices):
    RETURNABLE = "returnable", "Returnable"
    NON_RETURNABLE = "non_returnable", "Non-Returnable"


class DeliveryChallan(TenantOwnedModel):
    """History of generated Delivery Challans."""

    dc_number = models.CharField(max_length=120)
    dc_type = models.CharField(
        max_length=20, choices=ChallanType.choices, default=ChallanType.NON_RETURNABLE
    )
    site = models.ForeignKey(
        Site, on_delete=models.SET_NULL, null=True, blank=True, related_name="delivery_challans"
    )

    # Store the actual generated PDF document so it's never lost
    file = models.ForeignKey(
        "storage.StoredFile", on_delete=models.PROTECT, related_name="delivery_challans"
    )

    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_dcs",
    )

    # Store the products/items and quantities delivered on this DC
    items = models.JSONField(default=list, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "assets_delivery_challan"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        site_name = self.site.name if self.site else "N/A"
        return f"DC {self.dc_number} to {site_name}"

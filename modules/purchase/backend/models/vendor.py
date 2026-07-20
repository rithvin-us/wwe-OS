from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class Vendor(TenantOwnedModel):
    """A supplier bills can be attributed to. Deliberately minimal for v1 —
    the full vendor management module (docs/modules/vendors.md, currently
    removed from the single-operator app list) will extend this later."""

    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    gst_number = models.CharField(
        max_length=15,
        blank=True,
        help_text="GSTIN, if the vendor is GST-registered.",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "purchase_vendor"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="uniq_vendor_name_per_tenant"),
        ]

    def __str__(self) -> str:
        return self.name

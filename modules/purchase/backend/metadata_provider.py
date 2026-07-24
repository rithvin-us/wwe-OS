"""Registers this module's metadata extractor with platform/metadata —
turns a purchase-owned StoredFile into its business meaning. PurchaseBill
has no FK to StoredFile (storage_key is a plain string), so the lookup is
by key rather than by relation. See
docs/superpowers/specs/2026-07-25-metadata-engine-design.md.
"""

from __future__ import annotations

from metadata.registry import MetadataFields, MetadataProviderDef, register_metadata_provider

from purchase.backend.models import PurchaseBill


def _extract(stored_file) -> MetadataFields | None:
    bill = PurchaseBill.objects.filter(storage_key=stored_file.key).first()
    if bill is None:
        return None
    return MetadataFields(
        title=f"{bill.seller_name} — {bill.invoice_number or 'bill'}",
        status=bill.status,
        business_object_type="PurchaseBill",
        business_object_id=str(bill.id),
        extra={
            "vendor": bill.vendor.name if bill.vendor else bill.seller_name,
            "invoice_number": bill.invoice_number,
            "purchase_date": str(bill.purchase_date),
            "source_channel": bill.source_channel,
            "payment_status": bill.payment_status,
        },
    )


def register_metadata_provider_for_purchase() -> None:
    register_metadata_provider(MetadataProviderDef(module="purchase", extract=_extract))

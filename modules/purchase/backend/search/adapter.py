"""Search adapter registration for purchase bills."""

from __future__ import annotations

from search.registry import SearchAdapter, register
from storage.models import StoredFile

from purchase.backend.models import PurchaseBill

INDEX = "purchase"


def to_document(bill: PurchaseBill) -> dict:
    reference = bill.invoice_number or f"{bill.currency} {bill.total_rate}"
    body = " ".join(
        filter(
            None,
            [
                bill.seller_name,
                bill.invoice_number,
                bill.gst_number,
                bill.vendor.name if bill.vendor_id else "",
                bill.payment_method,
            ],
        )
    )
    # Same storage_key lookup pattern as purchase/backend/metadata_provider.py
    # (Subsystem 4) — PurchaseBill has no FK to StoredFile.
    stored = StoredFile.objects.filter(key=bill.storage_key).first() if bill.storage_key else None
    extra = {
        "status": bill.status,
        "payment_status": bill.payment_status,
        "document_type": "purchase_bill",
        "vendor": bill.vendor.name if bill.vendor_id else bill.seller_name,
        "source_channel": bill.source_channel,
    }
    if stored is not None:
        extra["period_year"] = stored.period_year
        extra["period_month"] = stored.period_month
        extra["is_library"] = stored.is_library
    return {
        "doc_id": str(bill.id),
        "title": f"Purchase: {bill.seller_name} ({reference})",
        "body": body,
        "extra": extra,
        "url": "/purchase",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Purchases",
            permission="purchase.bill.read",
            to_document=to_document,
            queryset=lambda: PurchaseBill.objects.all(),
        )
    )

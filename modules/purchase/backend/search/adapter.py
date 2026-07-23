"""Search adapter registration for purchase bills."""

from __future__ import annotations

from search.registry import SearchAdapter, register

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
    return {
        "doc_id": str(bill.id),
        "title": f"Purchase: {bill.seller_name} ({reference})",
        "body": body,
        "extra": {"status": bill.status, "payment_status": bill.payment_status},
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

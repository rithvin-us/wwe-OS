"""Search adapter registration for finance invoices.

Registers the outgoing-bill register with the platform search engine so an
invoice is reachable from the one command palette (Ctrl/⌘ K) alongside
purchases, documents, contracts and the rest. The platform owns querying,
ranking, tenant isolation and permission enforcement; this module only
declares how one invoice becomes a search document.

Indexing is driven from `InvoiceService._record` — the single choke point every
generate/correct/cancel already funnels through — so a cancelled bill stays
searchable with its new status rather than vanishing (a raised bill is never
deleted; see the Invoice model docstring).
"""

from __future__ import annotations

from finance.backend.models.invoice import Invoice
from search.registry import SearchAdapter, register

INDEX = "invoices"


def to_document(invoice: Invoice) -> dict:
    body = " ".join(
        filter(
            None,
            [
                invoice.consignee_name,
                invoice.facility,
                invoice.gstin,
                invoice.period_text,
                invoice.amount_in_words,
            ],
        )
    )
    return {
        "doc_id": str(invoice.id),
        "title": f"{invoice.number} · {invoice.consignee_name}",
        "body": body,
        "extra": {
            "status": invoice.status,
            "invoice_type": invoice.invoice_type,
            "financial_year": invoice.financial_year,
            "customer": invoice.consignee_name,
            "total": str(invoice.total),
            "period_year": invoice.period_year,
            "period_month": invoice.period_month,
        },
        "url": "/invoices",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Invoices",
            permission="finance.invoice.read",
            to_document=to_document,
            queryset=lambda: Invoice.objects.all(),
        )
    )

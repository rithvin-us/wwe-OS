"""Finance is wired into the one platform search index.

Generating, correcting and cancelling a bill keeps its search document in step
(all three funnel through `InvoiceService._record`), and the document is
reachable through the same permission-aware `SearchService` the command palette
queries. The platform owns querying/ranking/tenant-isolation — these tests only
prove the module declared itself correctly and indexes at the right moments.
"""

from __future__ import annotations

from datetime import date

import pytest
from finance.backend.models.invoice import InvoiceStatus, InvoiceType
from finance.backend.services.invoice import InvoiceService
from search.models import SearchDocument
from search.services import SearchService

pytestmark = pytest.mark.django_db

INDEX = "invoices"


def _generate(tenant, customer, line_items, **overrides):
    kwargs = {
        "tenant": tenant,
        "invoice_type": InvoiceType.SALES,
        "invoice_date": date(2026, 7, 26),
        "customer": customer,
        "lines": line_items(),
    }
    kwargs.update(overrides)
    return InvoiceService().generate(**kwargs)


def test_generating_an_invoice_indexes_it(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)

    doc = SearchDocument.objects.get(index=INDEX, doc_id=str(invoice.id))
    assert invoice.number in doc.title
    assert customer.name in doc.title
    assert doc.url == "/invoices"
    assert doc.extra["status"] == InvoiceStatus.ISSUED
    assert doc.extra["invoice_type"] == InvoiceType.SALES
    assert doc.extra["customer"] == invoice.consignee_name


def test_search_finds_an_invoice_by_number(tenant, customer, line_items, owner):
    invoice = _generate(tenant, customer, line_items)

    result = SearchService().search(user=owner, query=invoice.number, indexes=[INDEX])

    doc_ids = {row["doc_id"] for row in result["results"]}
    assert str(invoice.id) in doc_ids


def test_cancelling_keeps_the_invoice_indexed_with_its_new_status(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    InvoiceService().cancel(invoice=invoice, reason="Raised in error")

    doc = SearchDocument.objects.get(index=INDEX, doc_id=str(invoice.id))
    assert doc.extra["status"] == InvoiceStatus.CANCELLED


def test_search_is_gated_by_the_finance_read_permission(tenant, customer, line_items, make_user):
    """A user without finance.invoice.read must not see invoices in results —
    the platform enforces this from the adapter's declared permission."""
    _generate(tenant, customer, line_items)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    result = SearchService().search(user=stranger, query="invoice", indexes=[INDEX])

    assert result["results"] == []

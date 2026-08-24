"""Invoice revenue stats endpoint — the Executive Dashboard's revenue source.
Only issued invoices count as revenue; cancelled ones never do, and
"outstanding" is issued-but-unpaid.
"""

from __future__ import annotations

from datetime import date

import pytest
from finance.backend.models.invoice import Invoice, InvoiceType, PaymentStatus
from finance.backend.services.invoice import InvoiceService

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"


def _generate(tenant, customer, line_items, **overrides):
    kwargs = {
        "tenant": tenant,
        "invoice_type": InvoiceType.SALES,
        "invoice_date": date.today(),
        "customer": customer,
        "lines": line_items(),
    }
    kwargs.update(overrides)
    return InvoiceService().generate(**kwargs)


def test_stats_excludes_cancelled_from_revenue(auth_client, owner, tenant, customer, line_items):
    a = _generate(tenant, customer, line_items)
    b = _generate(tenant, customer, line_items)
    InvoiceService().cancel(invoice=b, reason="duplicate")

    response = auth_client(owner).get(f"{BASE}/invoices/stats/")

    assert response.status_code == 200, response.data
    body = response.data
    assert body["invoice_count"] == 1
    assert body["revenue_total"] == float(a.total)
    assert body["revenue_month"] == float(a.total)


def test_stats_scopes_revenue_month_to_the_current_month(
    auth_client, owner, tenant, customer, line_items
):
    this_month = _generate(tenant, customer, line_items)
    _generate(tenant, customer, line_items, invoice_date=date(2025, 1, 15))

    body = auth_client(owner).get(f"{BASE}/invoices/stats/").data

    # revenue_month counts only the current-month invoice; revenue_total both.
    assert body["revenue_month"] == float(this_month.total)
    assert body["revenue_total"] == float(this_month.total) * 2


def test_stats_outstanding_is_issued_but_unpaid(auth_client, owner, tenant, customer, line_items):
    paid = _generate(tenant, customer, line_items)
    unpaid = _generate(tenant, customer, line_items)
    Invoice.objects.filter(id=paid.id).update(payment_status=PaymentStatus.PAID)

    body = auth_client(owner).get(f"{BASE}/invoices/stats/").data

    assert body["outstanding"] == float(unpaid.total)


def test_stats_monthly_series_buckets_revenue_by_month_oldest_first(
    auth_client, owner, tenant, customer, line_items
):
    now = _generate(tenant, customer, line_items)
    _generate(tenant, customer, line_items, invoice_date=date(2025, 1, 15))

    monthly = auth_client(owner).get(f"{BASE}/invoices/stats/").data["monthly"]

    assert [row["period"] for row in monthly] == [
        "2025-01",
        f"{now.invoice_date.year}-{now.invoice_date.month:02d}",
    ]
    assert monthly[-1]["amount"] == float(now.total)
    assert monthly[-1]["count"] == 1


def test_stats_is_permission_gated(auth_client, make_user, tenant):
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    response = auth_client(stranger).get(f"{BASE}/invoices/stats/")

    assert response.status_code == 403

"""Customer 360 aggregates existing data honestly — real figures from the
invoice foreign key, sites derived from billed facilities, activity from the
audit trail, and no invented "outstanding".
"""

from __future__ import annotations

from datetime import date

import pytest
from finance.backend.models.invoice import InvoiceType
from finance.backend.services.customer_overview import CustomerOverviewService
from finance.backend.services.invoice import InvoiceService

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"


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


def test_financials_sum_only_active_invoices(tenant, customer, line_items):
    a = _generate(tenant, customer, line_items)
    b = _generate(tenant, customer, line_items)
    InvoiceService().cancel(invoice=b, reason="duplicate")

    data = CustomerOverviewService().overview(customer=customer)

    fin = data["financials"]
    assert fin["invoice_count"] == 2
    assert fin["active_count"] == 1
    assert fin["cancelled_count"] == 1
    assert fin["sales_count"] == 1
    # total_invoiced counts the active one only.
    assert fin["total_invoiced"] == str(a.total)
    # Payment isn't modelled, so outstanding is an honest null, never a guess.
    assert fin["outstanding"] is None


def test_sites_are_derived_from_billed_facilities(tenant, customer, line_items):
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")
    _generate(tenant, customer, line_items, facility="Saravanampatti Plant")
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")

    data = CustomerOverviewService().overview(customer=customer)

    sites = {s["name"]: s for s in data["sites"]}
    assert set(sites) >= {"Peelamedu Plant", "Saravanampatti Plant"}
    assert sites["Peelamedu Plant"]["invoice_count"] == 2
    assert sites["Saravanampatti Plant"]["invoice_count"] == 1


def test_amc_list_holds_only_amc_invoices(tenant, customer, line_items):
    _generate(tenant, customer, line_items, invoice_type=InvoiceType.SALES)
    _generate(tenant, customer, line_items, invoice_type=InvoiceType.AMC)

    data = CustomerOverviewService().overview(customer=customer)

    assert len(data["amc"]) == 1
    assert data["amc"][0]["invoice_type"] == InvoiceType.AMC


def test_activity_reflects_the_audit_trail(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)

    data = CustomerOverviewService().overview(customer=customer)

    assert data["activity"], "expected the generate action in the trail"
    assert data["activity"][0]["object_id"] == str(invoice.id)


def test_empty_customer_returns_honest_blanks(tenant, customer):
    data = CustomerOverviewService().overview(customer=customer)

    assert data["financials"]["invoice_count"] == 0
    assert data["financials"]["total_invoiced"] == "0.00"
    assert data["invoices"] == []
    assert data["activity"] == []
    # The customer's own default facility still shows as a site.
    assert [s["name"] for s in data["sites"]] == [customer.facility]


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #
def test_overview_endpoint_returns_the_aggregate(auth_client, owner, tenant, customer, line_items):
    _generate(tenant, customer, line_items)
    client = auth_client(owner)

    response = client.get(f"{BASE}/customers/{customer.id}/overview/")

    assert response.status_code == 200, response.data
    body = response.data.get("data", response.data)
    assert body["customer"]["name"] == customer.name
    assert body["financials"]["active_count"] == 1


def test_overview_endpoint_is_permission_gated(auth_client, make_user, tenant, customer):
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)
    client = auth_client(stranger)

    response = client.get(f"{BASE}/customers/{customer.id}/overview/")

    assert response.status_code == 403

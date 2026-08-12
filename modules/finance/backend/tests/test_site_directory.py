"""Site 360 is derived honestly from the bill register: facilities become the
site directory, and each site's picture is assembled from the invoices raised
against it — customers, SEZ, financials, AMC and activity — with unlinked areas
declared rather than faked.
"""

from __future__ import annotations

from datetime import date

import pytest
from finance.backend.models.invoice import InvoiceType
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.site_directory import SiteDirectoryService
from shared.exceptions import NotFoundError

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


def test_list_sites_groups_by_facility(tenant, customer, line_items):
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")
    _generate(tenant, customer, line_items, facility="Ganapathy Plant")

    sites = {s["name"]: s for s in SiteDirectoryService().list_sites(tenant=tenant)}

    assert set(sites) == {"Peelamedu Plant", "Ganapathy Plant"}
    assert sites["Peelamedu Plant"]["invoice_count"] == 2
    assert customer.name in sites["Peelamedu Plant"]["customers"]


def test_site_overview_reports_sez_from_invoices(tenant, sez_customer, line_items):
    _generate(tenant, sez_customer, line_items, facility="SEZ Block C")

    data = SiteDirectoryService().site_overview(tenant=tenant, name="SEZ Block C")

    assert data["is_sez"] is True
    assert data["financials"]["active_count"] == 1
    assert data["unlinked"] == ["employees", "documents", "purchases", "attendance"]


def test_site_overview_amc_only_lists_amc(tenant, customer, line_items):
    _generate(tenant, customer, line_items, facility="Kurichi", invoice_type=InvoiceType.SALES)
    _generate(tenant, customer, line_items, facility="Kurichi", invoice_type=InvoiceType.AMC)

    data = SiteDirectoryService().site_overview(tenant=tenant, name="Kurichi")

    assert data["financials"]["amc_count"] == 1
    assert len(data["amc"]) == 1
    assert data["amc"][0]["invoice_type"] == InvoiceType.AMC


def test_unknown_site_is_not_found(tenant):
    with pytest.raises(NotFoundError):
        SiteDirectoryService().site_overview(tenant=tenant, name="Nowhere")


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #
def test_sites_list_endpoint(auth_client, owner, tenant, customer, line_items):
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")

    response = auth_client(owner).get(f"{BASE}/sites/")

    assert response.status_code == 200, response.data
    assert any(site["name"] == "Peelamedu Plant" for site in response.data)


def test_site_overview_endpoint(auth_client, owner, tenant, customer, line_items):
    _generate(tenant, customer, line_items, facility="Peelamedu Plant")

    response = auth_client(owner).get(f"{BASE}/sites/overview/?name=Peelamedu Plant")

    assert response.status_code == 200, response.data
    assert response.data["name"] == "Peelamedu Plant"


def test_sites_endpoint_is_permission_gated(auth_client, make_user, tenant):
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    response = auth_client(stranger).get(f"{BASE}/sites/")

    assert response.status_code == 403

"""Business period read API — list, by-month detail, library, permissions,
tenant isolation."""

from __future__ import annotations

import pytest
from periods.services import PeriodService
from storage.services import StorageService

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4 fake but good enough"


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def _store_rotating(tenant, *, category="invoice", key="acme/2026/July/Invoices/invoice.pdf"):
    stored = StorageService().store(
        data=PDF,
        filename="invoice.pdf",
        content_type="application/pdf",
        module="documents",
        tenant=tenant,
        category=category,
        key=key,
        period_year=2026,
        period_month=7,
    )
    period = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)
    PeriodService().refresh_manifest(period=period)
    return stored


def test_api_list_periods(tenant, owner, auth_client):
    _store_rotating(tenant)
    client = auth_client(owner)

    response = client.get("/api/v1/periods/")
    assert response.status_code == 200
    rows = response.data["data"]
    assert len(rows) == 1
    assert rows[0]["year"] == 2026
    assert rows[0]["month"] == 7
    assert rows[0]["manifest"]["document_counts"] == {"invoice": 1}


def test_api_by_month_detail(tenant, owner, auth_client):
    _store_rotating(tenant)
    client = auth_client(owner)

    response = client.get("/api/v1/periods/2026/7/")
    assert response.status_code == 200
    assert response.data["manifest"]["total_count"] == 1
    assert len(response.data["recent_uploads"]) == 1


def test_api_by_month_missing_period_returns_no_data(tenant, owner, auth_client):
    client = auth_client(owner)
    response = client.get("/api/v1/periods/2026/7/")
    assert response.status_code == 200
    assert response.data["data"] is None


def test_api_library_counts(tenant, owner, auth_client):
    StorageService().store(
        data=PDF,
        filename="policy.pdf",
        content_type="application/pdf",
        module="documents",
        tenant=tenant,
        category="insurance",
        key="acme/Library/Insurance/policy.pdf",
        is_library=True,
    )
    client = auth_client(owner)

    response = client.get("/api/v1/periods/library/")
    assert response.status_code == 200
    assert response.data["document_counts"] == {"insurance": 1}
    assert response.data["total_count"] == 1


def test_api_requires_periods_view_permission(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    client = auth_client(nobody)
    assert client.get("/api/v1/periods/").status_code == 403


def test_api_tenant_isolation(
    tenant, other_tenant, owner, make_user, grant, owner_role, auth_client
):
    _store_rotating(tenant)

    outsider = make_user(email="owner@globex.test", username="globex", tenant=other_tenant)
    grant(outsider, owner_role)
    assert auth_client(outsider).get("/api/v1/periods/").data["data"] == []

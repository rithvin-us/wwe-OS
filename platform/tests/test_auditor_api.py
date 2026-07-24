"""Auditor package manual-trigger API."""

from __future__ import annotations

import pytest
from storage.services import StorageService

pytestmark = pytest.mark.django_db

GENERATE_URL = "/api/v1/auditor/packages/generate/"


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def _store_pdf(tenant):
    import io

    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return StorageService().store(
        data=buf.getvalue(),
        filename="inv.pdf",
        content_type="application/pdf",
        module="test",
        category="invoice",
        tenant=tenant,
        period_year=2026,
        period_month=7,
    )


def test_api_generates_and_returns_a_completed_run(tenant, owner, auth_client):
    _store_pdf(tenant)
    client = auth_client(owner)

    response = client.post(GENERATE_URL, {"year": 2026, "month": 7}, format="json")
    assert response.status_code == 201
    assert response.data["status"] == "success"
    assert response.data["pipeline_key"] == "auditor.package.generate"


def test_api_requires_auditor_generate_permission(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    client = auth_client(nobody)

    response = client.post(GENERATE_URL, {"year": 2026, "month": 7}, format="json")
    assert response.status_code == 403


def test_api_rejects_invalid_month(tenant, owner, auth_client):
    client = auth_client(owner)
    response = client.post(GENERATE_URL, {"year": 2026, "month": 13}, format="json")
    assert response.status_code == 422

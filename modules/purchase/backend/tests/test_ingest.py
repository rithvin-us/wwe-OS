from __future__ import annotations

import pytest

from purchase.backend.models import BillStatus, PurchaseBill

pytestmark = pytest.mark.django_db

INGEST_URL = "/api/v1/purchase/bills/ingest/"

VALID_PAYLOAD = {
    "seller_name": "Vendor Inc.",
    "purchase_date": "2026-07-20",
    "total_rate": "150.00",
    "currency": "USD",
    "telegram_user_id": 123456789,
    "document_url": "https://storage.internal/path/to/file.pdf",
}


def test_ingest_requires_service_token(api, tenant):
    resp = api.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 401


def test_ingest_rejects_wrong_service_token(api, tenant):
    api.credentials(HTTP_AUTHORIZATION="Service wrong-token")
    resp = api.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 401


def test_ingest_creates_pending_bill(service_client, tenant):
    resp = service_client.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "pending_review"
    bill = PurchaseBill.objects.get()
    assert bill.seller_name == "Vendor Inc."
    assert bill.status == BillStatus.PENDING_REVIEW
    assert bill.tenant_id == tenant.id
    assert bill.telegram_user_id == 123456789


def test_ingest_rejects_missing_fields(service_client, tenant):
    resp = service_client.post(INGEST_URL, {"seller_name": "Vendor"}, format="json")
    assert resp.status_code == 422


def test_ingest_rejects_future_date(service_client, tenant):
    payload = {**VALID_PAYLOAD, "purchase_date": "2099-01-01"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 422


def test_ingest_fails_without_a_tenant_configured(service_client):
    # No tenant fixture used here — simulates a fresh, unconfigured company.
    resp = service_client.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 409


def test_ingest_notifies_the_owner(service_client, tenant, owner):
    service_client.post(INGEST_URL, VALID_PAYLOAD, format="json")
    from notifications.models import Notification

    assert Notification.objects.filter(recipient=owner, category="purchase").exists()


def test_ingest_deduplicates_by_external_ref(service_client, tenant):
    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-abc123"}
    assert service_client.post(INGEST_URL, payload, format="json").status_code == 201

    duplicate = service_client.post(INGEST_URL, payload, format="json")
    assert duplicate.status_code == 409
    assert PurchaseBill.objects.count() == 1


def test_ingest_without_external_ref_never_deduplicates(service_client, tenant):
    assert service_client.post(INGEST_URL, VALID_PAYLOAD, format="json").status_code == 201
    assert service_client.post(INGEST_URL, VALID_PAYLOAD, format="json").status_code == 201
    assert PurchaseBill.objects.count() == 2


def test_ingest_rejects_non_https_document_url(service_client, tenant):
    payload = {**VALID_PAYLOAD, "document_url": "http://insecure.example/file.pdf"}
    assert service_client.post(INGEST_URL, payload, format="json").status_code == 422

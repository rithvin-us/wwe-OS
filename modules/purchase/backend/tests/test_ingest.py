from __future__ import annotations

from unittest.mock import Mock

import httpx
import pytest
from documents.backend.models import Document
from search.models import SearchDocument
from storage.models import StoredFile

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
    "raw_extraction": {
        "vendor": "Vendor Inc.",
        "grand_total": "150.00",
        "confidence_score": 0.95,
    },
}


def test_ingest_requires_service_token(api, tenant):
    resp = api.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 401


def test_ingest_rejects_wrong_service_token(api, tenant):
    api.credentials(HTTP_AUTHORIZATION="Service wrong-token")
    resp = api.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 401


def test_ingest_creates_processed_bill(service_client, tenant):
    resp = service_client.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "processed"
    bill = PurchaseBill.objects.get()
    assert bill.seller_name == "Vendor Inc."
    assert bill.status == BillStatus.PROCESSED
    assert bill.tenant_id == tenant.id
    assert bill.telegram_user_id == 123456789


def test_ingest_low_confidence_creates_needs_attention(service_client, tenant):
    payload = {
        **VALID_PAYLOAD,
        "raw_extraction": {
            "vendor": "Unclear Store",
            "grand_total": "50.00",
            "confidence_score": 0.40,
        },
    }
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "needs_attention"


def test_ingest_rejects_future_date(service_client, tenant):
    payload = {**VALID_PAYLOAD, "purchase_date": "2099-01-01"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 422


def test_ingest_fails_without_a_tenant_configured(service_client):
    resp = service_client.post(INGEST_URL, VALID_PAYLOAD, format="json")
    assert resp.status_code == 409


def test_ingest_deduplicates_by_external_ref(service_client, tenant):
    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-abc123"}
    assert service_client.post(INGEST_URL, payload, format="json").status_code == 201

    duplicate = service_client.post(INGEST_URL, payload, format="json")
    assert duplicate.status_code == 201
    assert PurchaseBill.objects.count() == 1


# --------------------------------------------------------------------------- #
# Pipeline integrity: storage, search, and the documents cross-module event
# --------------------------------------------------------------------------- #


def _fake_response(*, content=b"%PDF-1.4 fake bill", content_type="application/pdf"):
    response = Mock(spec=httpx.Response)
    response.content = content
    response.headers = {"content-type": content_type}
    response.raise_for_status.side_effect = None
    return response


def test_ingest_stores_indexes_and_registers_document(service_client, tenant, monkeypatch):
    monkeypatch.setattr(
        "purchase.backend.services.purchase_bill.httpx.get",
        lambda url, timeout: _fake_response(),
    )
    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-store-1"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201

    bill = PurchaseBill.objects.get()
    assert bill.storage_key

    stored = StoredFile.objects.get(key=bill.storage_key)
    assert stored.content_type == "application/pdf"
    assert stored.tenant_id == tenant.id

    assert SearchDocument.objects.filter(index="purchase", doc_id=str(bill.id)).exists()

    document = Document.objects.get(file=stored)
    assert document.tenant_id == tenant.id
    assert "Vendor Inc." in document.title


def test_ingest_survives_a_document_fetch_failure(service_client, tenant, monkeypatch):
    def _raise(url, timeout):
        raise httpx.ConnectError("boom", request=Mock())

    monkeypatch.setattr("purchase.backend.services.purchase_bill.httpx.get", _raise)
    monkeypatch.setattr("purchase.backend.services.purchase_bill.time.sleep", lambda s: None)

    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-fail-1"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201

    bill = PurchaseBill.objects.get()
    assert bill.storage_key == ""
    assert Document.objects.count() == 0


# --------------------------------------------------------------------------- #
# Business periods (platform/periods integration)
# --------------------------------------------------------------------------- #


def test_ingest_files_bill_into_its_purchase_date_period_not_upload_date(
    service_client, tenant, monkeypatch
):
    from periods.models import BusinessPeriod

    monkeypatch.setattr(
        "purchase.backend.services.purchase_bill.httpx.get",
        lambda url, timeout: _fake_response(),
    )
    # purchase_date (2026-07-20) is in the past relative to "today" in any
    # real test run — proves the period comes from the business date, not
    # from when ingestion happened.
    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-period-1"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201

    bill = PurchaseBill.objects.get()
    assert bill.storage_key.startswith(f"{tenant.slug}/2026/July/Purchase Bills/")

    period = BusinessPeriod.objects.get(tenant=tenant, year=2026, month=7)
    assert period.manifest.document_counts == {"purchase_bill": 1}


def test_ingest_reuses_existing_storage_key_without_re_resolving(
    service_client, tenant, monkeypatch
):
    """A second ingest for the same external_ref (e.g. the bot's phase-2
    re-post with OCR results) must not re-file the already-stored document
    even if its extracted invoice_date differs — retroactive re-filing is
    Rules Engine scope, not this subsystem."""
    monkeypatch.setattr(
        "purchase.backend.services.purchase_bill.httpx.get",
        lambda url, timeout: _fake_response(),
    )
    payload = {**VALID_PAYLOAD, "external_ref": "tg-file-period-2"}
    first = service_client.post(INGEST_URL, payload, format="json")
    assert first.status_code == 201
    first_key = PurchaseBill.objects.get().storage_key

    second_payload = {
        **payload,
        "raw_extraction": {**payload["raw_extraction"], "invoice_date": "2026-01-05"},
    }
    second = service_client.post(INGEST_URL, second_payload, format="json")
    assert second.status_code == 201
    assert PurchaseBill.objects.get().storage_key == first_key


# --------------------------------------------------------------------------- #
# Source identity (platform/identity integration)
# --------------------------------------------------------------------------- #


def test_ingest_resolves_source_identity_before_ocr(service_client, tenant):
    from identity.models import IdentityChannel, SourceIdentity

    payload = {**VALID_PAYLOAD, "external_ref": "tg-identity-1"}
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201

    identity = SourceIdentity.objects.get(
        tenant=tenant, channel=IdentityChannel.TELEGRAM, external_id="123456789"
    )
    assert identity.mapped_object_type == "Vendor"


def test_ingest_reuses_the_same_identity_across_bills_from_one_account(service_client, tenant):
    from identity.models import SourceIdentity

    service_client.post(
        INGEST_URL, {**VALID_PAYLOAD, "external_ref": "tg-identity-2a"}, format="json"
    )
    service_client.post(
        INGEST_URL, {**VALID_PAYLOAD, "external_ref": "tg-identity-2b"}, format="json"
    )

    assert SourceIdentity.objects.filter(tenant=tenant, external_id="123456789").count() == 1


def test_ingest_maps_identity_to_the_resolved_vendor(service_client, tenant):
    from identity.models import SourceIdentity

    from purchase.backend.models import PurchaseBill

    payload = {**VALID_PAYLOAD, "external_ref": "tg-identity-3"}
    service_client.post(INGEST_URL, payload, format="json")

    bill = PurchaseBill.objects.get()
    identity = SourceIdentity.objects.get(tenant=tenant, external_id="123456789")
    assert identity.mapped_module == "purchase"
    assert identity.mapped_object_type == "Vendor"
    assert identity.mapped_object_id == str(bill.vendor_id)


# --------------------------------------------------------------------------- #
# Unified metadata (platform/metadata integration)
# --------------------------------------------------------------------------- #


# --------------------------------------------------------------------------- #
# Rules Engine (platform/rules integration)
# --------------------------------------------------------------------------- #


def test_ingest_with_malformed_gst_needs_attention_and_records_the_reason(service_client, tenant):
    payload = {
        **VALID_PAYLOAD,
        "external_ref": "tg-rules-1",
        "raw_extraction": {**VALID_PAYLOAD["raw_extraction"], "gst_number": "not-a-gst"},
    }
    resp = service_client.post(INGEST_URL, payload, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "needs_attention"

    bill = PurchaseBill.objects.get()
    assert "invalid_gst_format" in bill.raw_extraction["rule_reasons"]


def test_metadata_service_resolves_bill_fields_by_storage_key(service_client, tenant, monkeypatch):
    from metadata.services import MetadataService
    from storage.models import StoredFile

    from purchase.backend.models import PurchaseBill

    monkeypatch.setattr(
        "purchase.backend.services.purchase_bill.httpx.get",
        lambda url, timeout: _fake_response(),
    )
    payload = {**VALID_PAYLOAD, "external_ref": "tg-metadata-1"}
    service_client.post(INGEST_URL, payload, format="json")

    bill = PurchaseBill.objects.get()
    stored = StoredFile.objects.get(key=bill.storage_key)

    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)
    assert metadata["extra"]["vendor"] == "Vendor Inc."
    assert metadata["extra"]["invoice_number"] == bill.invoice_number
    assert metadata["extra"]["source_channel"] == "telegram"

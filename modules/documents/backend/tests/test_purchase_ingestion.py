"""Documents reacts to purchase's `purchase.bill.ingested` event.

Proves the cross-module wiring goes through the event bus, never a direct
import of purchase's models/services — see
documents.backend.events.subscribers's module docstring.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from documents.backend.events.subscribers import _create_document_from_purchase_bill
from documents.backend.models import Document
from storage.services import StorageService

pytestmark = pytest.mark.django_db


def _stub_bill(*, tenant, storage_key, seller_name="Vendor Inc.", invoice_number="INV-1"):
    return SimpleNamespace(
        tenant=tenant,
        storage_key=storage_key,
        seller_name=seller_name,
        purchase_date="2026-07-20",
        invoice_number=invoice_number,
        currency="USD",
        total_rate="150.00",
    )


def test_creates_a_document_for_an_ingested_bill_with_a_stored_file(tenant, owner):
    stored = StorageService().store(
        data=b"%PDF-1.4 fake bill",
        filename="bill.pdf",
        content_type="application/pdf",
        module="purchase",
        category="bill",
        tenant=tenant,
        uploaded_by=owner,
    )
    bill = _stub_bill(tenant=tenant, storage_key=stored.key)

    _create_document_from_purchase_bill("purchase.bill.ingested", instance=bill)

    document = Document.objects.get(file=stored)
    assert document.tenant_id == tenant.id
    assert "Vendor Inc." in document.title
    assert "INV-1" in document.description


def test_is_a_no_op_when_the_storage_key_matches_no_file(tenant):
    bill = _stub_bill(tenant=tenant, storage_key="does-not-exist")

    _create_document_from_purchase_bill("purchase.bill.ingested", instance=bill)

    assert Document.objects.count() == 0


def test_is_a_no_op_when_no_file_was_stored(tenant):
    bill = _stub_bill(tenant=tenant, storage_key="")

    _create_document_from_purchase_bill("purchase.bill.ingested", instance=bill)

    assert Document.objects.count() == 0

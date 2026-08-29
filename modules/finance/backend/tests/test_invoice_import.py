"""Bulk historical-invoice import: OCR → review → commit, and the numbering
guarantees that make back-filling safe.

OCR itself is stubbed (the gateway is exercised by the platform's own tests);
here we prove the import *mechanics* — the printed number is preserved, the
sequence continues past it, a scan is kept, duplicates are refused, and the
async pipeline actually drains an item to a reviewable draft.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from finance.backend.models import (
    InvoiceImportItem,
    InvoiceImportItemStatus,
)
from finance.backend.models.invoice import Invoice, InvoiceSource, InvoiceType
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.invoice_import import InvoiceImportService
from finance.backend.services.numbering import InvoiceNumberingService, parse_invoice_number
from shared.exceptions import ConflictError, ValidationError
from workflow.models import PipelineRun
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _body(response):
    return response.data.get("data", response.data)


def _extraction(**overrides) -> dict:
    """A realistic normalized OCR result for a G/M/12 sales invoice to Acme's
    own customer fixture (gstin matches, so customer-matching should fire)."""
    base = {
        "number": "G/M/12/2026-27",
        "invoice_date": "2026-06-15",
        "invoice_type": "sales",
        "consignee_name": "Waterworks Engineering Pvt Ltd",
        "consignee_address": "12 Industrial Estate, Coimbatore",
        "gstin": "33AABFW6153H1Z8",
        "is_sez": False,
        "gst_rate": "18",
        "period_month": None,
        "period_year": None,
        "lines": [
            {
                "description": "Pump overhaul",
                "hsn": "998719",
                "quantity": "2",
                "uom": "Nos",
                "rate": "5000",
            }
        ],
        "subtotal": "10000",
        "cgst_amount": "900",
        "sgst_amount": "900",
        "igst_amount": "0",
        "round_off": "0",
        "total": "11800",
        "amount_in_words": "",
        "currency": "INR",
        "confidence_score": 0.95,
        "document_type": "printed",
        "unreadable_fields": [],
    }
    base.update(overrides)
    return base


@pytest.fixture
def stub_ocr(monkeypatch):
    """Install a fixed OCR result on the extractor class."""

    def _install(extraction: dict):
        monkeypatch.setattr(
            "finance.backend.services.invoice_ocr.InvoiceOCRService.extract_from_image",
            lambda self, *args, **kwargs: dict(extraction),
        )

    return _install


def _drain(items) -> None:
    for item in items:
        run = PipelineRun.objects.get(id=item.run_id)
        PipelineService().run_to_completion(run)
        item.refresh_from_db()


# --------------------------------------------------------------------------- #
# parse_invoice_number
# --------------------------------------------------------------------------- #
def test_parse_invoice_number_round_trips():
    assert parse_invoice_number("G/M/12/2026-27") == (12, "2026-27")


@pytest.mark.parametrize("bad", ["", "G/M", "G/M/x/2026-27", "G/M/12/2026", "G/M/0/2026-27"])
def test_parse_invoice_number_rejects_malformed(bad):
    with pytest.raises(ValidationError):
        parse_invoice_number(bad)


# --------------------------------------------------------------------------- #
# import_historical — the numbering-preservation core
# --------------------------------------------------------------------------- #
def test_import_preserves_number_and_continues_the_series(tenant, customer, line_items, settings):
    invoice = InvoiceService().import_historical(
        number="G/M/12/2026-27",
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 6, 15),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.number == "G/M/12/2026-27"
    assert invoice.sequence_number == 12
    assert invoice.source == InvoiceSource.IMPORTED
    # Documents are regenerated even though it was imported.
    assert invoice.pdf_file_id is not None
    assert invoice.file_id is not None

    # The next freshly generated bill lands *above* the imported one.
    generated = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 6, 20),
        customer=customer,
        lines=line_items(),
    )
    assert generated.number == "G/M/13/2026-27"
    assert InvoiceNumberingService().peek(tenant=tenant, financial_year="2026-27") == 14


def test_import_rejects_a_number_already_on_the_register(tenant, customer, line_items):
    InvoiceService().import_historical(
        number="G/M/7/2026-27",
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 6, 15),
        customer=customer,
        lines=line_items(),
    )
    with pytest.raises(ConflictError):
        InvoiceService().import_historical(
            number="G/M/7/2026-27",
            tenant=tenant,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 6, 16),
            customer=customer,
            lines=line_items(),
        )


def test_import_rejects_financial_year_that_disagrees_with_the_date(tenant, customer, line_items):
    with pytest.raises(ConflictError):
        InvoiceService().import_historical(
            number="G/M/3/2025-26",  # FY 2025-26 ...
            tenant=tenant,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 6, 15),  # ... but the date is in 2026-27
            customer=customer,
            lines=line_items(),
        )


def test_import_goes_through_a_locked_period(tenant, customer, line_items, monkeypatch):
    """A back-fill records history, so it is not blocked by a locked accounting
    period the way raising a fresh bill is."""
    monkeypatch.setattr(
        "periods.services.PeriodService.assert_open",
        lambda self, **kwargs: (_ for _ in ()).throw(ConflictError("period locked")),
    )
    # Raising a new bill refuses.
    with pytest.raises(ConflictError):
        InvoiceService().generate(
            tenant=tenant,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 6, 15),
            customer=customer,
            lines=line_items(),
        )
    # Importing an already-issued one does not.
    invoice = InvoiceService().import_historical(
        number="G/M/4/2026-27",
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 6, 15),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.number == "G/M/4/2026-27"


# --------------------------------------------------------------------------- #
# create_batch + OCR pipeline
# --------------------------------------------------------------------------- #
def test_upload_stores_scans_dedupes_and_queues_ocr(tenant, owner):
    result = InvoiceImportService().create_batch(
        tenant=tenant,
        actor=owner,
        files=[
            {"filename": "a.pdf", "content_type": "application/pdf", "data": PDF},
            {
                "filename": "a-again.pdf",
                "content_type": "application/pdf",
                "data": PDF,
            },  # same bytes
            {"filename": "b.pdf", "content_type": "application/pdf", "data": PDF + b"x"},
        ],
    )
    assert len(result["accepted"]) == 2  # the duplicate is dropped
    assert result["duplicates"] == ["a-again.pdf"]
    # Each accepted item has a scan and a queued pipeline run.
    for item in result["accepted"]:
        assert item.source_file_id is not None
        assert PipelineRun.objects.filter(id=item.run_id).exists()


def test_pipeline_extracts_maps_and_matches_customer(tenant, owner, customer, stub_ocr):
    stub_ocr(_extraction())
    result = InvoiceImportService().create_batch(
        tenant=tenant,
        actor=owner,
        files=[{"filename": "inv.pdf", "content_type": "application/pdf", "data": PDF}],
    )
    _drain(result["accepted"])

    item = result["accepted"][0]
    item.refresh_from_db()
    assert item.status == InvoiceImportItemStatus.EXTRACTED
    assert item.proposed_number == "G/M/12/2026-27"
    assert item.confidence_score == Decimal("0.950")
    assert item.proposed_total == Decimal("11800.00")
    # gstin matched the customer master.
    assert item.proposed["customer_id"] == str(customer.id)


def test_low_confidence_lands_in_needs_attention(tenant, owner, stub_ocr):
    stub_ocr(_extraction(confidence_score=0.40))
    result = InvoiceImportService().create_batch(
        tenant=tenant,
        actor=owner,
        files=[{"filename": "inv.pdf", "content_type": "application/pdf", "data": PDF}],
    )
    _drain(result["accepted"])
    item = result["accepted"][0]
    item.refresh_from_db()
    assert item.status == InvoiceImportItemStatus.NEEDS_ATTENTION


def test_commit_item_writes_the_register_and_keeps_the_scan(tenant, owner, customer, stub_ocr):
    stub_ocr(_extraction())
    result = InvoiceImportService().create_batch(
        tenant=tenant,
        actor=owner,
        files=[{"filename": "inv.pdf", "content_type": "application/pdf", "data": PDF}],
    )
    _drain(result["accepted"])
    item = result["accepted"][0]
    item.refresh_from_db()

    invoice = InvoiceImportService().commit_item(item=item, actor=owner)
    item.refresh_from_db()

    assert item.status == InvoiceImportItemStatus.COMMITTED
    assert item.invoice_id == invoice.id
    assert invoice.number == "G/M/12/2026-27"
    assert invoice.source == InvoiceSource.IMPORTED
    # The original scan is kept on the register row for analytics.
    assert invoice.source_file_id == item.source_file_id
    assert invoice.total == Decimal("11800.00")


def test_sez_draft_totals_use_igst(tenant, sez_customer):
    totals = InvoiceImportService().compute_totals_for_draft(
        tenant=tenant,
        draft={
            "customer_id": str(sez_customer.id),
            "gst_rate": "18",
            "lines": [{"description": "X", "quantity": "1", "rate": "10000"}],
        },
    )
    assert totals["igst_amount"] == Decimal("1800.00")
    assert totals["cgst_amount"] == Decimal("0.00")


# --------------------------------------------------------------------------- #
# API + permissions
# --------------------------------------------------------------------------- #
def test_upload_requires_the_import_permission(tenant, make_user, auth_client):
    from permissions.models import Permission
    from roles.models import Role
    from roles.services import RoleService

    reader = make_user("reader@acme.test", "reader", tenant=tenant)
    role = Role.objects.create(tenant=tenant, name="Reader", slug="reader")
    role.permissions.set(Permission.objects.filter(code="finance.invoice.read"))
    RoleService().assign_role(user=reader, role=role)

    response = auth_client(reader).post(
        f"{BASE}/invoice-imports/",
        {"files": _upload("inv.pdf")},
        format="multipart",
    )
    assert response.status_code == 403


def test_api_upload_then_commit_flow(tenant, owner, customer, auth_client, stub_ocr):
    stub_ocr(_extraction())
    client = auth_client(owner)

    created = client.post(
        f"{BASE}/invoice-imports/", {"files": _upload("inv.pdf")}, format="multipart"
    )
    assert created.status_code == 201
    batch = _body(created)
    assert batch["accepted"] == 1
    item_id = batch["items"][0]["id"]

    # Drain OCR (background in prod; explicit here).
    item = InvoiceImportItem.objects.get(id=item_id)
    PipelineService().run_to_completion(PipelineRun.objects.get(id=item.run_id))

    committed = client.post(f"{BASE}/invoice-import-items/{item_id}/commit/")
    assert committed.status_code == 201
    assert _body(committed)["number"] == "G/M/12/2026-27"
    assert Invoice.objects.filter(tenant=tenant, number="G/M/12/2026-27").exists()


def _upload(name: str):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, PDF, content_type="application/pdf")

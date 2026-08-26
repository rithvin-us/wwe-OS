"""The rest of a bill's life: the PDF it is sent as, previewing it before it
exists, correcting it, and cancelling it."""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from finance.backend.models.invoice import Invoice, InvoiceStatus, InvoiceType, TaxMode
from finance.backend.services import pdf
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.numbering import InvoiceNumberingService
from shared.exceptions import ConflictError, ValidationError

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"


def _body(response):
    return response.data.get("data", response.data)


def _text_of(payload: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(payload))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _raise(tenant, customer, line_items, **overrides):
    kwargs = {
        "tenant": tenant,
        "invoice_type": InvoiceType.SALES,
        "invoice_date": date(2026, 7, 26),
        "customer": customer,
        "lines": line_items(),
    }
    kwargs.update(overrides)
    return InvoiceService().generate(**kwargs)


def _api_payload(customer, **overrides):
    payload = {
        "invoice_type": InvoiceType.SALES,
        "invoice_date": "2026-07-26",
        "customer_id": str(customer.id),
        "lines": [{"description": "Pump overhaul", "quantity": 2, "rate": "5000.00"}],
    }
    payload.update(overrides)
    return payload


# --------------------------------------------------------------------------- #
# PDF
# --------------------------------------------------------------------------- #
def test_generating_an_invoice_also_produces_a_pdf(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    assert invoice.pdf_file is not None
    assert invoice.pdf_file.content_type == pdf.CONTENT_TYPE
    assert invoice.pdf_file.filename.endswith(".pdf")
    assert Path(invoice.pdf_local_path).is_file()


def test_the_pdf_carries_the_numbers_that_matter(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items, invoice_type=InvoiceType.AMC)
    from storage.services import StorageService

    payload = StorageService().open(invoice.pdf_file)
    assert payload.startswith(b"%PDF")

    text = _text_of(payload)
    assert invoice.number in text
    assert "Waterworks Engineering" in text
    assert "For the month of June - 2026" in text
    assert "NET TOTAL" in text
    assert "SGST 9%" in text


def test_an_sez_pdf_shows_igst_and_no_split(tenant, sez_customer, line_items):
    invoice = _raise(tenant, sez_customer, line_items)
    from storage.services import StorageService

    text = _text_of(StorageService().open(invoice.pdf_file))
    assert "IGST 18%" in text
    assert "CGST" not in text


def test_the_pdf_reads_the_company_block_out_of_the_template(tenant, customer, line_items):
    """Company name, GST number and bank details are printed on the workbook,
    not configured in code — the PDF must pull them from there."""
    invoice = _raise(tenant, customer, line_items)
    from storage.services import StorageService

    text = _text_of(StorageService().open(invoice.pdf_file))
    assert "WATER WORKS ENGINEERING" in text
    assert "33AABFW6153H1Z8" in text
    assert "HDFC" in text


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0", "0.00"),
        ("999.5", "999.50"),
        ("1234.5", "1,234.50"),
        ("123456.78", "1,23,456.78"),
        ("21386300", "2,13,86,300.00"),
        ("-0.2", "-0.20"),
    ],
)
def test_rupees_print_with_indian_digit_grouping(value, expected):
    assert pdf._inr(Decimal(value)) == expected


def test_the_libreoffice_engine_says_so_plainly_when_it_is_not_installed(settings, monkeypatch):
    settings.INVOICE_PDF_ENGINE = pdf.ENGINE_LIBREOFFICE

    def _missing(*args, **kwargs):
        raise FileNotFoundError

    monkeypatch.setattr(pdf.subprocess, "run", _missing)
    with pytest.raises(pdf.InvoicePdfError) as caught:
        pdf.build_invoice_pdf(xlsx_bytes=b"x")
    assert "not installed" in str(caught.value)


def test_an_unknown_pdf_engine_is_refused(settings):
    settings.INVOICE_PDF_ENGINE = "magic"
    with pytest.raises(pdf.InvoicePdfError):
        pdf.build_invoice_pdf(xlsx_bytes=b"x")


# --------------------------------------------------------------------------- #
# Preview the document itself
# --------------------------------------------------------------------------- #
def test_previewing_the_document_takes_no_number_and_writes_no_file(tenant, customer, line_items):
    payload = InvoiceService().preview_document(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert payload.startswith(b"%PDF")
    assert "PREVIEW" in _text_of(payload)
    assert Invoice.objects.count() == 0
    assert InvoiceNumberingService().peek(tenant=tenant, financial_year="2026-27") == 1


def test_preview_document_over_the_api(owner, auth_client, customer):
    response = auth_client(owner).post(
        f"{BASE}/invoices/preview-document/", _api_payload(customer), format="json"
    )
    assert response.status_code == 200
    assert response["Content-Type"] == pdf.CONTENT_TYPE
    assert response.content.startswith(b"%PDF")
    assert Invoice.objects.count() == 0


# --------------------------------------------------------------------------- #
# Correcting
# --------------------------------------------------------------------------- #
def test_correcting_a_bill_keeps_its_number_and_bumps_the_revision(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    assert invoice.revision == 1

    corrected = InvoiceService().update(
        invoice=invoice,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=[{"description": "Corrected item", "quantity": 3, "rate": "2000.00"}],
    )
    assert corrected.number == "G/M/1/2026-27"
    assert corrected.revision == 2
    assert corrected.subtotal == Decimal("6000.00")
    assert corrected.lines.count() == 1
    assert corrected.lines.first().description == "Corrected item"


def test_correcting_regenerates_both_documents(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    old_workbook, old_pdf = invoice.file, invoice.pdf_file

    corrected = InvoiceService().update(
        invoice=invoice,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=[{"description": "Corrected item", "quantity": 1, "rate": "999.00"}],
    )
    assert corrected.file_id != old_workbook.id
    assert corrected.pdf_file_id != old_pdf.id

    from storage.providers import get_provider

    assert not get_provider().exists(old_workbook.key)
    assert get_provider().exists(corrected.file.key)


def test_correcting_can_switch_the_tax_mode(tenant, customer, sez_customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    assert invoice.tax_mode == TaxMode.CGST_SGST

    corrected = InvoiceService().update(
        invoice=invoice,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=sez_customer,
        lines=line_items(),
    )
    assert corrected.tax_mode == TaxMode.IGST
    assert corrected.cgst_amount == Decimal("0.00")


def test_a_cancelled_bill_cannot_be_corrected(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    InvoiceService().cancel(invoice=invoice, reason="Raised twice")
    with pytest.raises(ConflictError):
        InvoiceService().update(
            invoice=invoice,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 7, 26),
            customer=customer,
            lines=line_items(),
        )


def test_a_bill_cannot_be_corrected_into_another_financial_year(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    with pytest.raises(ConflictError) as caught:
        InvoiceService().update(
            invoice=invoice,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 2, 1),  # 2025-26
            customer=customer,
            lines=line_items(),
        )
    assert "financial year" in str(caught.value)


# --------------------------------------------------------------------------- #
# Cancelling
# --------------------------------------------------------------------------- #
def test_cancelling_records_the_reason_and_the_moment(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    cancelled = InvoiceService().cancel(invoice=invoice, reason="  Duplicate of G/M/1  ")
    assert cancelled.status == InvoiceStatus.CANCELLED
    assert cancelled.cancellation_reason == "Duplicate of G/M/1"
    assert cancelled.cancelled_at is not None


def test_a_cancelled_bill_never_gives_its_number_back(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    InvoiceService().cancel(invoice=invoice, reason="Wrong customer")
    assert _raise(tenant, customer, line_items).number == "G/M/2/2026-27"


def test_cancelling_needs_a_reason(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    with pytest.raises(ValidationError):
        InvoiceService().cancel(invoice=invoice, reason="   ")


def test_a_bill_can_only_be_cancelled_once(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    InvoiceService().cancel(invoice=invoice, reason="Wrong figures")
    with pytest.raises(ConflictError):
        InvoiceService().cancel(invoice=invoice, reason="Again")


def test_the_documents_of_a_cancelled_bill_are_left_as_issued(tenant, customer, line_items):
    """A cancellation is recorded beside an issued document, never painted
    over it."""
    invoice = _raise(tenant, customer, line_items)
    workbook_key, pdf_key = invoice.file.key, invoice.pdf_file.key
    InvoiceService().cancel(invoice=invoice, reason="Customer withdrew the order")

    from storage.providers import get_provider

    assert get_provider().exists(workbook_key)
    assert get_provider().exists(pdf_key)


# --------------------------------------------------------------------------- #
# Locked business periods
# --------------------------------------------------------------------------- #
def _lock_july(tenant):
    from periods.models import BusinessPeriod, PeriodStatus

    BusinessPeriod.objects.update_or_create(
        tenant=tenant,
        year=2026,
        month=7,
        defaults={"is_locked": True, "status": PeriodStatus.CLOSED},
    )


def test_a_locked_month_refuses_a_new_bill(tenant, customer, line_items):
    _lock_july(tenant)
    with pytest.raises(ConflictError):
        _raise(tenant, customer, line_items)


def test_a_locked_month_refuses_a_correction(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    _lock_july(tenant)
    with pytest.raises(ConflictError):
        InvoiceService().update(
            invoice=invoice,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 7, 26),
            customer=customer,
            lines=line_items(),
        )


def test_a_locked_month_refuses_a_cancellation(tenant, customer, line_items):
    invoice = _raise(tenant, customer, line_items)
    _lock_july(tenant)
    with pytest.raises(ConflictError):
        InvoiceService().cancel(invoice=invoice, reason="Too late")


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
def test_pdf_endpoint_serves_the_document_inline(owner, auth_client, customer):
    client = auth_client(owner)
    created = _body(client.post(f"{BASE}/invoices/", _api_payload(customer), format="json"))
    assert created["pdf_url"].endswith("/pdf/")

    response = client.get(f"{BASE}/invoices/{created['id']}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == pdf.CONTENT_TYPE
    assert response["Content-Disposition"].startswith("inline;")
    assert response.content.startswith(b"%PDF")


def test_correcting_over_the_api(owner, auth_client, customer):
    client = auth_client(owner)
    created = _body(client.post(f"{BASE}/invoices/", _api_payload(customer), format="json"))

    corrected = _body(
        client.patch(
            f"{BASE}/invoices/{created['id']}/",
            _api_payload(
                customer,
                lines=[{"description": "Revised", "quantity": 1, "rate": "1000.00"}],
            ),
            format="json",
        )
    )
    assert corrected["number"] == created["number"]
    assert corrected["revision"] == 2
    assert corrected["total"] == "1180.00"


def test_cancelling_over_the_api(owner, auth_client, customer):
    client = auth_client(owner)
    created = _body(client.post(f"{BASE}/invoices/", _api_payload(customer), format="json"))

    cancelled = _body(
        client.post(
            f"{BASE}/invoices/{created['id']}/cancel/",
            {"reason": "Duplicate"},
            format="json",
        )
    )
    assert cancelled["status"] == InvoiceStatus.CANCELLED
    assert cancelled["cancellation_reason"] == "Duplicate"


def test_a_sent_bill_cannot_be_deleted_over_the_api(owner, auth_client, customer):
    """Deletion is only for a bill still at the generated stage. Marking it sent
    puts it in the customer's hands, and from there the way to void it is
    cancel — which keeps the row, the number and a reason on the register."""
    client = auth_client(owner)
    created = _body(client.post(f"{BASE}/invoices/", _api_payload(customer), format="json"))
    client.post(f"{BASE}/invoices/{created['id']}/mark-sent/")

    response = client.delete(f"{BASE}/invoices/{created['id']}/")

    assert response.status_code == 409
    assert Invoice.objects.filter(id=created["id"]).exists()

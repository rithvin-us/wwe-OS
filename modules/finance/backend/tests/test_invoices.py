"""End to end: generating an invoice files a workbook on local disk, in the
platform's period folders, and writes the register row — over the API the
Automation tab actually calls."""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal
from pathlib import Path

import openpyxl
import pytest
from finance.backend.models.invoice import Invoice, InvoiceType, TaxMode
from finance.backend.services.invoice import InvoiceService

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"


def _body(response):
    """The platform wraps every response in a success envelope."""
    return response.data.get("data", response.data)


def _payload(customer, **overrides):
    payload = {
        "invoice_type": InvoiceType.SALES,
        "invoice_date": "2026-07-26",
        "customer_id": str(customer.id),
        "lines": [
            {
                "description": "Pressure pump overhaul",
                "hsn": "998719",
                "quantity": 2,
                "uom": "Nos",
                "rate": "5000.00",
            }
        ],
    }
    payload.update(overrides)
    return payload


# --------------------------------------------------------------------------- #
# Local saving
# --------------------------------------------------------------------------- #
def test_the_workbook_is_written_to_local_disk(tenant, customer, line_items, settings):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    path = Path(invoice.local_path)
    assert path.is_file()
    assert path.stat().st_size > 0
    assert Path(settings.INVOICE_LOCAL_ARCHIVE_PATH) in path.parents


def test_invoices_are_filed_by_year_month_and_type(tenant, customer, line_items):
    amc = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.AMC,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    sales = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert amc.file.key.startswith("acme/2026/July/AMC Invoices/")
    assert sales.file.key.startswith("acme/2026/July/Sales Invoices/")
    assert amc.file.key.endswith(".xlsx")


def test_the_filename_carries_the_bill_number_and_the_customer(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.file.filename.startswith("G-M-1-2026-27_waterworks")


def test_a_local_copy_exists_even_when_the_platform_stores_elsewhere(
    tenant, customer, line_items, settings, tmp_path, monkeypatch
):
    """The operator keeps their own books — an object store is not enough."""
    from storage import providers

    archive = tmp_path / "invoice-archive"
    settings.INVOICE_LOCAL_ARCHIVE_PATH = str(archive)

    class _Elsewhere(providers.StorageProvider):
        def __init__(self):
            self.written = {}

        def put(self, key, data, content_type):
            self.written[key] = data

        def get(self, key):
            return self.written[key]

        def delete(self, key): ...
        def exists(self, key):
            return key in self.written

        def signed_url(self, key, *, expires_seconds, filename=""):
            return "https://example.test/x"

    remote = _Elsewhere()
    monkeypatch.setattr(providers, "get_provider", lambda: remote)
    monkeypatch.setattr("storage.services.get_provider", lambda: remote)
    monkeypatch.setattr("finance.backend.services.invoice.get_provider", lambda: remote)

    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert Path(invoice.local_path).is_file()
    assert invoice.file.key in remote.written


# --------------------------------------------------------------------------- #
# SEZ and AMC, through the service
# --------------------------------------------------------------------------- #
def test_an_sez_customer_makes_the_invoice_igst(tenant, sez_customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=sez_customer,
        lines=line_items(),
    )
    assert invoice.is_sez is True
    assert invoice.tax_mode == TaxMode.IGST
    assert invoice.igst_amount == Decimal("1800.00")
    assert invoice.cgst_amount == Decimal("0.00")


def test_a_normal_customer_makes_the_invoice_cgst_plus_sgst(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.tax_mode == TaxMode.CGST_SGST
    assert invoice.cgst_amount == invoice.sgst_amount == Decimal("900.00")


def test_an_amc_invoice_records_and_prints_the_billed_month(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.AMC,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.period_text == "For the month of June - 2026"
    assert (invoice.period_year, invoice.period_month) == (2026, 6)

    from storage.services import StorageService

    sheet = openpyxl.load_workbook(io.BytesIO(StorageService().open(invoice.file))).active
    assert sheet["B17"].value == "For the month of June - 2026"


def test_a_sales_invoice_carries_no_month_text(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    assert invoice.period_text == ""
    assert invoice.period_month is None


def test_customer_details_are_snapshotted_onto_the_bill(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    customer.name = "Renamed Later Pvt Ltd"
    customer.is_sez = True
    customer.save()

    invoice.refresh_from_db()
    assert invoice.consignee_name == "Waterworks Engineering Pvt Ltd"
    assert invoice.is_sez is False


def test_a_sales_invoice_stores_every_line_item(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(12),
    )
    assert invoice.lines.count() == 12
    assert invoice.subtotal == Decimal("120000.00")


def test_an_invoice_needs_at_least_one_line(tenant, customer):
    from shared.exceptions import ValidationError

    with pytest.raises(ValidationError):
        InvoiceService().generate(
            tenant=tenant,
            invoice_type=InvoiceType.SALES,
            invoice_date=date(2026, 7, 26),
            customer=customer,
            lines=[],
        )


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
def test_generate_over_the_api(owner, auth_client, customer):
    response = auth_client(owner).post(f"{BASE}/invoices/", _payload(customer), format="json")
    assert response.status_code == 201, response.data
    body = _body(response)
    assert body["number"] == "G/M/1/2026-27"
    assert body["total"] == "11800.00"
    assert body["local_path"]
    assert body["download_url"].endswith("/download/")


def test_preview_computes_everything_without_taking_a_number(owner, auth_client, sez_customer):
    client = auth_client(owner)
    payload = _payload(sez_customer, invoice_type=InvoiceType.AMC)

    first = client.post(f"{BASE}/invoices/preview/", payload, format="json")
    assert first.status_code == 200, first.data
    body = _body(first)
    assert body["number"] == "G/M/1/2026-27"
    assert body["tax_mode"] == TaxMode.IGST
    assert body["period_text"] == "For the month of June - 2026"
    assert body["amount_in_words"].startswith("Rupees")

    # Previewing twice, then generating, still yields number 1.
    client.post(f"{BASE}/invoices/preview/", payload, format="json")
    created = client.post(f"{BASE}/invoices/", payload, format="json")
    created_body = _body(created)
    assert created_body["number"] == "G/M/1/2026-27"
    assert Invoice.objects.count() == 1


def test_next_number_endpoint_reports_the_upcoming_bill_number(owner, auth_client, customer):
    client = auth_client(owner)
    client.post(f"{BASE}/invoices/", _payload(customer), format="json")
    response = client.get(f"{BASE}/invoices/next-number/?invoice_date=2026-07-26")
    body = _body(response)
    assert body["number"] == "G/M/2/2026-27"
    assert body["financial_year"] == "2026-27"


def test_the_generated_workbook_can_be_downloaded(owner, auth_client, customer):
    client = auth_client(owner)
    created = client.post(f"{BASE}/invoices/", _payload(customer), format="json")
    body = _body(created)

    response = client.get(f"{BASE}/invoices/{body['id']}/download/")
    assert response.status_code == 200
    assert response["Content-Disposition"].startswith("attachment;")
    sheet = openpyxl.load_workbook(io.BytesIO(response.content)).active
    assert sheet["F4"].value == "G/M/1/2026-27"


def test_the_sez_flag_lives_on_the_customer_master(owner, auth_client):
    client = auth_client(owner)
    created = client.post(
        f"{BASE}/customers/",
        {"name": "SEZ Unit", "address": "Block 9", "is_sez": True},
        format="json",
    )
    assert created.status_code == 201, created.data
    body = _body(created)
    assert body["is_sez"] is True

    invoice = client.post(
        f"{BASE}/invoices/",
        {
            "invoice_type": InvoiceType.SALES,
            "invoice_date": "2026-07-26",
            "customer_id": body["id"],
            "lines": [{"description": "Spares", "quantity": 1, "rate": "1000.00"}],
        },
        format="json",
    )
    invoice_body = _body(invoice)
    assert invoice_body["tax_mode"] == TaxMode.IGST


def test_a_bill_needs_a_customer_or_a_typed_consignee(owner, auth_client):
    response = auth_client(owner).post(
        f"{BASE}/invoices/",
        {
            "invoice_type": InvoiceType.SALES,
            "invoice_date": "2026-07-26",
            "lines": [{"description": "Spares", "quantity": 1, "rate": "1000.00"}],
        },
        format="json",
    )
    # 422 is the platform's contract for a well-formed but invalid payload.
    assert response.status_code == 422

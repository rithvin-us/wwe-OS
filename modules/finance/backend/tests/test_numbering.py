"""The shared bill sequence: one number per invoice, no gaps, no repeats,
whichever kind of invoice asks for it."""

from __future__ import annotations

from datetime import date

import pytest
from finance.backend.models.invoice import Invoice, InvoiceType, TaxMode
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.numbering import (
    InvoiceNumberingService,
    financial_year_for,
    format_invoice_number,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 7, 26), "2026-27"),
        (date(2026, 4, 1), "2026-27"),
        (date(2026, 3, 31), "2025-26"),
        (date(2027, 1, 5), "2026-27"),
    ],
)
def test_financial_year_starts_in_april(day, expected):
    assert financial_year_for(day) == expected


def test_number_format_matches_the_paper_invoice():
    assert format_invoice_number(12, "2026-27") == "G/M/12/2026-27"


def test_prefix_is_configuration_not_a_literal(settings):
    settings.INVOICE_NUMBER_PREFIX = "W/W"
    assert format_invoice_number(3, "2026-27") == "W/W/3/2026-27"


def test_reserve_hands_out_consecutive_numbers(tenant):
    service = InvoiceNumberingService()
    issued = [service.reserve(tenant=tenant, financial_year="2026-27") for _ in range(5)]
    assert issued == [1, 2, 3, 4, 5]


def test_peek_does_not_consume_a_number(tenant):
    service = InvoiceNumberingService()
    assert service.peek(tenant=tenant, financial_year="2026-27") == 1
    assert service.peek(tenant=tenant, financial_year="2026-27") == 1
    assert service.reserve(tenant=tenant, financial_year="2026-27") == 1


def test_sequences_are_independent_per_financial_year(tenant):
    service = InvoiceNumberingService()
    service.reserve(tenant=tenant, financial_year="2025-26")
    service.reserve(tenant=tenant, financial_year="2025-26")
    assert service.reserve(tenant=tenant, financial_year="2026-27") == 1


def test_sequence_continues_from_the_latest_saved_bill(tenant, customer):
    """A bill written straight into the register — imported, or back-filled by
    hand — still pushes the counter past itself."""
    Invoice.objects.create(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        number="G/M/47/2026-27",
        financial_year="2026-27",
        sequence_number=47,
        invoice_date=date(2026, 7, 1),
        consignee_name="Back-filled",
        tax_mode=TaxMode.CGST_SGST,
    )
    assert InvoiceNumberingService().reserve(tenant=tenant, financial_year="2026-27") == 48


def test_a_cancelled_invoice_never_gives_its_number_back(tenant):
    Invoice.objects.create(
        tenant=tenant,
        invoice_type=InvoiceType.AMC,
        number="G/M/9/2026-27",
        financial_year="2026-27",
        sequence_number=9,
        invoice_date=date(2026, 7, 1),
        consignee_name="Cancelled",
        tax_mode=TaxMode.CGST_SGST,
    ).delete()  # soft delete
    assert InvoiceNumberingService().reserve(tenant=tenant, financial_year="2026-27") == 10


def test_amc_and_sales_share_one_sequence(tenant, customer, sez_customer, line_items):
    service = InvoiceService()
    common = {"tenant": tenant, "invoice_date": date(2026, 7, 26), "lines": line_items()}

    first = service.generate(invoice_type=InvoiceType.AMC, customer=customer, **common)
    second = service.generate(invoice_type=InvoiceType.SALES, customer=sez_customer, **common)
    third = service.generate(invoice_type=InvoiceType.AMC, customer=customer, **common)

    assert [i.number for i in (first, second, third)] == [
        "G/M/1/2026-27",
        "G/M/2/2026-27",
        "G/M/3/2026-27",
    ]


def test_generation_updates_the_bill_register(tenant, customer, line_items):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(2),
    )
    saved = Invoice.objects.get(pk=invoice.pk)
    assert saved.number == "G/M/1/2026-27"
    assert saved.sequence_number == 1
    assert saved.financial_year == "2026-27"
    assert saved.lines.count() == 2


def test_duplicate_numbers_are_impossible(tenant):
    from django.db.utils import IntegrityError

    shared = {
        "tenant": tenant,
        "invoice_type": InvoiceType.SALES,
        "financial_year": "2026-27",
        "sequence_number": 5,
        "invoice_date": date(2026, 7, 1),
        "consignee_name": "Anyone",
        "tax_mode": TaxMode.CGST_SGST,
    }
    Invoice.objects.create(number="G/M/5/2026-27", **shared)
    with pytest.raises(IntegrityError):
        Invoice.objects.create(number="G/M/5/2026-27", **shared)

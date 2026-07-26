"""SEZ tax mode, AMC month text, totals and rupees-in-words — all pure."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from finance.backend.models.invoice import TaxMode
from finance.backend.services import computation
from finance.backend.services.words import number_to_words, rupees_in_words


def _lines(*amounts):
    return computation.compute_lines(
        [{"description": "Item", "quantity": 1, "rate": amount} for amount in amounts]
    )


# --------------------------------------------------------------------------- #
# SEZ
# --------------------------------------------------------------------------- #
def test_sez_site_switches_the_tax_mode_to_igst():
    assert computation.tax_mode_for(is_sez=True) == TaxMode.IGST


def test_non_sez_site_stays_on_cgst_plus_sgst():
    assert computation.tax_mode_for(is_sez=False) == TaxMode.CGST_SGST


def test_sez_invoice_charges_igst_only():
    totals = computation.compute_totals(_lines(10000), tax_mode=TaxMode.IGST)
    assert totals.igst_amount == Decimal("1800.00")
    assert totals.cgst_amount == Decimal("0.00")
    assert totals.sgst_amount == Decimal("0.00")
    assert totals.total == Decimal("11800.00")


def test_non_sez_invoice_splits_the_rate_across_cgst_and_sgst():
    totals = computation.compute_totals(_lines(10000), tax_mode=TaxMode.CGST_SGST)
    assert totals.cgst_amount == Decimal("900.00")
    assert totals.sgst_amount == Decimal("900.00")
    assert totals.igst_amount == Decimal("0.00")
    assert totals.total == Decimal("11800.00")


def test_tax_row_labels_follow_the_mode():
    assert computation.tax_labels(tax_mode=TaxMode.CGST_SGST) == ("SGST 9%", "CGST 9%")
    assert computation.tax_labels(tax_mode=TaxMode.IGST) == ("IGST 18%", "")


def test_a_non_default_rate_is_respected():
    totals = computation.compute_totals(_lines(1000), tax_mode=TaxMode.IGST, gst_rate=Decimal("12"))
    assert totals.igst_amount == Decimal("120.00")
    assert computation.tax_labels(tax_mode=TaxMode.CGST_SGST, gst_rate=Decimal("12")) == (
        "SGST 6%",
        "CGST 6%",
    )


# --------------------------------------------------------------------------- #
# Totals and rounding
# --------------------------------------------------------------------------- #
def test_multiple_line_items_are_summed():
    totals = computation.compute_totals(_lines(1000, 2500, 700), tax_mode=TaxMode.IGST)
    assert totals.subtotal == Decimal("4200.00")


def test_the_invoice_rounds_to_the_nearest_rupee():
    totals = computation.compute_totals(_lines("1234.55"), tax_mode=TaxMode.IGST)
    assert totals.gross == Decimal("1456.77")
    assert totals.round_off == Decimal("0.23")
    assert totals.total == Decimal("1457.00")


def test_line_amount_is_quantity_times_rate():
    lines = computation.compute_lines(
        [{"description": "Service", "quantity": "2.5", "rate": "400.00"}]
    )
    assert lines[0].amount == Decimal("1000.00")


# --------------------------------------------------------------------------- #
# AMC month text
# --------------------------------------------------------------------------- #
def test_amc_text_defaults_to_the_month_before_the_invoice_date():
    year, month = computation.billing_period(invoice_date=date(2026, 7, 26))
    assert computation.amc_period_text(year, month) == "For the month of June - 2026"


def test_amc_text_rolls_back_across_the_year_boundary():
    year, month = computation.billing_period(invoice_date=date(2026, 1, 3))
    assert computation.amc_period_text(year, month) == "For the month of December - 2025"


def test_an_explicit_billing_period_wins():
    year, month = computation.billing_period(
        invoice_date=date(2026, 7, 26), period_year=2026, period_month=3
    )
    assert computation.amc_period_text(year, month) == "For the month of March - 2026"


# --------------------------------------------------------------------------- #
# Rupees in words
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "Zero"),
        (7, "Seven"),
        (19, "Nineteen"),
        (85, "Eighty Five"),
        (100, "One Hundred"),
        (1_234, "One Thousand Two Hundred Thirty Four"),
        (1_00_000, "One Lakh"),
        (12_34_567, "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"),
        (2_00_00_000, "Two Crore"),
    ],
)
def test_indian_number_grouping(value, expected):
    assert number_to_words(value) == expected


def test_rupees_in_words_includes_paise_when_there_are_any():
    assert rupees_in_words(Decimal("1234.50")) == (
        "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only"
    )


def test_rupees_in_words_omits_paise_on_a_whole_amount():
    assert rupees_in_words(Decimal("11800.00")) == ("Rupees Eleven Thousand Eight Hundred Only")

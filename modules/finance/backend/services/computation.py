"""Pure invoice arithmetic and wording — no database, no files, no side
effects. Everything here is a function of its arguments, which is what makes
the tax and AMC-period rules cheap to test and safe to reuse from the preview
endpoint (which must compute exactly what generation will produce, without
touching anything).
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from finance.backend.models.invoice import TaxMode

TWO_PLACES = Decimal("0.01")
DEFAULT_GST_RATE = Decimal("18.00")


def money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class ComputedLine:
    position: int
    description: str
    hsn: str
    quantity: Decimal
    uom: str
    rate: Decimal
    amount: Decimal


@dataclass(frozen=True)
class ComputedTotals:
    subtotal: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    gross: Decimal
    round_off: Decimal
    total: Decimal


def tax_mode_for(*, is_sez: bool) -> str:
    """The one place SEZ turns into a tax mode. An SEZ site is an inter-state
    supply for GST purposes, so it carries IGST; everything else is split into
    CGST + SGST."""
    return TaxMode.IGST if is_sez else TaxMode.CGST_SGST


def compute_lines(raw_lines: list[dict]) -> list[ComputedLine]:
    computed: list[ComputedLine] = []
    for index, raw in enumerate(raw_lines, start=1):
        quantity = Decimal(str(raw.get("quantity", 1) or 0))
        rate = money(raw.get("rate", 0) or 0)
        computed.append(
            ComputedLine(
                position=index,
                description=str(raw.get("description", "")).strip(),
                hsn=str(raw.get("hsn", "") or "").strip(),
                quantity=quantity,
                uom=str(raw.get("uom", "") or "Nos").strip() or "Nos",
                rate=rate,
                amount=money(quantity * rate),
            )
        )
    return computed


def compute_totals(
    lines: list[ComputedLine], *, tax_mode: str, gst_rate: Decimal = DEFAULT_GST_RATE
) -> ComputedTotals:
    """Taxes are charged on the sum of the line values. The invoice is then
    rounded to the nearest rupee, with the difference shown on the template's
    "R/OFF" row — the same convention the paper invoice already used."""
    subtotal = money(sum((line.amount for line in lines), Decimal("0")))
    rate = Decimal(str(gst_rate))

    if tax_mode == TaxMode.IGST:
        cgst = sgst = Decimal("0.00")
        igst = money(subtotal * rate / Decimal("100"))
    else:
        half = rate / Decimal("2")
        cgst = money(subtotal * half / Decimal("100"))
        sgst = cgst
        igst = Decimal("0.00")

    gross = money(subtotal + cgst + sgst + igst)
    total = gross.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return ComputedTotals(
        subtotal=subtotal,
        cgst_amount=cgst,
        sgst_amount=sgst,
        igst_amount=igst,
        gross=gross,
        round_off=money(total - gross),
        total=money(total),
    )


def tax_labels(*, tax_mode: str, gst_rate: Decimal = DEFAULT_GST_RATE) -> tuple[str, str]:
    """The two tax rows printed on the invoice. SEZ prints one row (IGST at
    the full rate) and leaves the second blank; everyone else prints the rate
    split in half across SGST and CGST."""
    rate = Decimal(str(gst_rate))
    if tax_mode == TaxMode.IGST:
        return f"IGST {_trim(rate)}%", ""
    half = _trim(rate / Decimal("2"))
    return f"SGST {half}%", f"CGST {half}%"


def _trim(value: Decimal) -> str:
    """`Decimal("9.00")` -> `"9"`, `Decimal("2.50")` -> `"2.5"` — rates print
    the way a person writes them."""
    text = format(value.normalize(), "f")
    return text


def billing_period(
    *, invoice_date: date, period_year: int | None = None, period_month: int | None = None
) -> tuple[int, int]:
    """The month an AMC invoice covers. Explicit if given, otherwise the month
    before the invoice date — an AMC bill is raised in arrears."""
    if period_year and period_month:
        return period_year, period_month
    previous = invoice_date.replace(day=1) - timedelta(days=1)
    return previous.year, previous.month


def amc_period_text(year: int, month: int) -> str:
    """`(2026, 6)` -> `"For the month of June - 2026"`. Printed above the item
    rows on AMC invoices only."""
    return f"For the month of {calendar.month_name[month]} - {year}"

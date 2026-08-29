"""The shared AMC + Sales bill number sequence.

One sequence per financial year, one number per invoice, never a gap and
never a repeat. Three rules make that hold:

* **Reserve, don't guess.** `reserve()` is the only way a number is issued,
  and it is the same call whether the invoice was raised by an automation or
  typed in by hand — so a manual bill takes the next number rather than
  inventing one beside the sequence.
* **The register wins over the counter.** Every allocation takes
  `max(counter, highest number already saved) + 1`, so an invoice imported or
  back-filled straight into the register still pushes the sequence past it.
  Soft-deleted invoices count: a cancelled bill has already been seen by the
  outside world and its number must never be handed out again.
* **The database has the last word.** `Invoice`'s unique constraints on
  `(tenant, financial_year, sequence_number)` and `(tenant, number)` mean a
  race that slipped past both of the above still cannot commit.
"""

from __future__ import annotations

import re
from datetime import date

from django.conf import settings
from django.db import connection, models, transaction
from finance.backend.models.invoice import Invoice, InvoiceNumberSequence
from shared.exceptions import ValidationError
from shared.services import BaseService

# Indian financial year: 1 April - 31 March.
FY_START_MONTH = 4

# "2026-27" — four digits, hyphen, two digits.
_FINANCIAL_YEAR_RE = re.compile(r"^\d{4}-\d{2}$")


def financial_year_for(day: date) -> str:
    """`date(2026, 7, 26)` -> `"2026-27"`; `date(2026, 2, 1)` -> `"2025-26"`."""
    start = day.year if day.month >= FY_START_MONTH else day.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def format_invoice_number(sequence_number: int, financial_year: str) -> str:
    """`(12, "2026-27")` -> `"G/M/12/2026-27"`. The prefix is configuration
    (`INVOICE_NUMBER_PREFIX`), not a literal, so it can change without a
    code change when the company's numbering does."""
    return f"{settings.INVOICE_NUMBER_PREFIX}/{sequence_number}/{financial_year}"


def parse_invoice_number(number: str) -> tuple[int, str]:
    """`"G/M/12/2026-27"` -> `(12, "2026-27")`. The inverse of
    `format_invoice_number`, for back-filling a historical invoice under the
    number it already carries.

    Parses from the right so a configurable, slash-containing prefix is handled:
    the last `/`-segment is the financial year, the one before it the integer
    serial. Anything that is not `.../<int>/<YYYY-YY>` raises `ValidationError`
    — the operator then corrects the number by hand in the review grid.
    """
    parts = [segment.strip() for segment in str(number).split("/") if segment.strip()]
    if len(parts) < 2:
        raise ValidationError(
            detail={"number": ["An invoice number must look like PREFIX/<serial>/<YYYY-YY>."]}
        )
    financial_year, serial = parts[-1], parts[-2]
    if not _FINANCIAL_YEAR_RE.match(financial_year):
        raise ValidationError(
            detail={"number": [f"'{financial_year}' is not a financial year like 2026-27."]}
        )
    try:
        sequence_number = int(serial)
    except ValueError:
        raise ValidationError(
            detail={"number": [f"'{serial}' is not a whole invoice serial number."]}
        ) from None
    if sequence_number <= 0:
        raise ValidationError(detail={"number": ["The invoice serial must be a positive number."]})
    return sequence_number, financial_year


def _highest_saved(tenant, financial_year: str) -> int:
    # all_objects: soft-deleted invoices still hold their number.
    aggregate = Invoice.all_objects.filter(tenant=tenant, financial_year=financial_year).aggregate(
        highest=models.Max("sequence_number")
    )
    return aggregate["highest"] or 0


class InvoiceNumberingService(BaseService):
    def peek(self, *, tenant, financial_year: str) -> int:
        """The number the next invoice would get. Reserves nothing — this is
        what the preview shows, so opening a preview never burns a number."""
        row = InvoiceNumberSequence.all_objects.filter(
            tenant=tenant, financial_year=financial_year
        ).first()
        counter = row.last_number if row else 0
        return max(counter, _highest_saved(tenant, financial_year)) + 1

    def reserve(self, *, tenant, financial_year: str) -> int:
        """Claims and returns the next number, atomically."""
        with transaction.atomic():
            row, _created = InvoiceNumberSequence.all_objects.get_or_create(
                tenant=tenant, financial_year=financial_year, defaults={"last_number": 0}
            )
            # Lock the counter row for the rest of the transaction where the
            # database supports it. SQLite (tests) does not, and does not need
            # to — it serialises writes anyway.
            if connection.features.has_select_for_update:
                row = InvoiceNumberSequence.all_objects.select_for_update().filter(pk=row.pk).get()
            row.last_number = max(row.last_number, _highest_saved(tenant, financial_year)) + 1
            row.save(update_fields=["last_number", "updated_at"])
            return row.last_number

    def reconcile(self, *, tenant, financial_year: str, sequence_number: int) -> int:
        """Pulls the counter up to at least `sequence_number`, atomically.

        Used when a historical invoice is back-filled under its own printed
        number instead of one freshly reserved: the next `reserve()` must land
        above it. `reserve()`/`peek()` already reconcile against the highest
        number saved, so this is belt-and-braces — but it makes the guarantee
        hold the instant the import commits, independently of that scan and safe
        against a concurrent reserve."""
        with transaction.atomic():
            row, _created = InvoiceNumberSequence.all_objects.get_or_create(
                tenant=tenant, financial_year=financial_year, defaults={"last_number": 0}
            )
            if connection.features.has_select_for_update:
                row = InvoiceNumberSequence.all_objects.select_for_update().filter(pk=row.pk).get()
            new_value = max(row.last_number, sequence_number)
            if new_value != row.last_number:
                row.last_number = new_value
                row.save(update_fields=["last_number", "updated_at"])
            return row.last_number

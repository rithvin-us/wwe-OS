"""Clears Finance's demo data — raised invoices and the number sequence.

Registered into the platform's demo-reset registry (``shared.demo_reset``) so
``manage.py reset_demo_data`` can wipe finance rows without the platform ever
importing this module. Invoices are hard-deleted (their lines cascade) and the
per-financial-year counters are removed, so the very next invoice starts again
at 1. Invoices must go before the platform command deletes StoredFiles, since
``Invoice.file``/``pdf_file`` are ``on_delete=PROTECT``.
"""

from __future__ import annotations

from shared.demo_reset import register_demo_resetter


def _reset_finance_demo(tenant=None) -> None:
    from finance.backend.models.invoice import Invoice, InvoiceNumberSequence

    invoices = Invoice.all_objects.all()
    sequences = InvoiceNumberSequence.all_objects.all()
    if tenant is not None:
        invoices = invoices.filter(tenant=tenant)
        sequences = sequences.filter(tenant=tenant)

    # Hard delete: InvoiceLine FKs cascade; the counter rows go so numbering
    # restarts from 1 rather than resuming past the wiped invoices.
    invoices.hard_delete()
    sequences.hard_delete()


def register_demo_reset() -> None:
    register_demo_resetter("finance.invoices", _reset_finance_demo)

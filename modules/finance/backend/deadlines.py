"""Finance's deadline source: invoices with a due date that are not yet paid.

Registers with the platform Deadline Engine so unpaid bills — overdue, or due
within the horizon — show up in the one deadlines view alongside contract
expiry and everything else. The engine owns aggregation and permission
enforcement; this only maps an invoice to a `Deadline`.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta

from deadlines.registry import Deadline, DeadlineSource, register
from finance.backend.models.invoice import Invoice, InvoiceStatus, PaymentStatus

KIND = "invoice_due"


def _upcoming(tenant, within_days: int) -> Iterable[Deadline]:
    today = date.today()
    horizon = today + timedelta(days=within_days)
    qs = Invoice.objects.filter(
        status=InvoiceStatus.ISSUED,
        payment_status=PaymentStatus.UNPAID,
        due_date__isnull=False,
        due_date__lte=horizon,
    )
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    for invoice in qs.order_by("due_date"):
        days_remaining = (invoice.due_date - today).days
        yield Deadline(
            kind=KIND,
            label=f"{invoice.number} · {invoice.consignee_name}",
            due_date=invoice.due_date,
            days_remaining=days_remaining,
            is_overdue=days_remaining < 0,
            url="/invoices",
            object_id=str(invoice.id),
            extra={"total": str(invoice.total), "customer": invoice.consignee_name},
        )


def register_deadlines() -> None:
    register(
        DeadlineSource(
            kind=KIND,
            label="Invoice due",
            permission="finance.invoice.read",
            upcoming=_upcoming,
        )
    )

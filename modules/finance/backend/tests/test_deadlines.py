"""The Deadline Engine surfaces unpaid invoices with a due date — overdue or
due within the horizon — through the platform aggregation service and endpoint.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from deadlines.services import DeadlineService
from finance.backend.models.invoice import InvoiceType
from finance.backend.services.invoice import InvoiceService

pytestmark = pytest.mark.django_db


def _invoice_with_due(tenant, customer, line_items, *, due_offset_days):
    invoice = InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )
    InvoiceService().set_due_date(
        invoice=invoice, due_date=date.today() + timedelta(days=due_offset_days)
    )
    return invoice


def test_overdue_invoice_appears_in_deadlines(owner, tenant, customer, line_items):
    invoice = _invoice_with_due(tenant, customer, line_items, due_offset_days=-3)

    deadlines = DeadlineService().upcoming(user=owner, within_days=30)

    row = next(d for d in deadlines if d["object_id"] == str(invoice.id))
    assert row["kind"] == "invoice_due"
    assert row["is_overdue"] is True
    assert row["days_remaining"] == -3


def test_far_future_invoice_is_outside_the_horizon(owner, tenant, customer, line_items):
    invoice = _invoice_with_due(tenant, customer, line_items, due_offset_days=200)

    deadlines = DeadlineService().upcoming(user=owner, within_days=30)

    assert all(d["object_id"] != str(invoice.id) for d in deadlines)


def test_paid_invoice_drops_out_of_deadlines(owner, tenant, customer, line_items):
    invoice = _invoice_with_due(tenant, customer, line_items, due_offset_days=-3)
    InvoiceService().mark_paid(invoice=invoice)

    deadlines = DeadlineService().upcoming(user=owner, within_days=30)

    assert all(d["object_id"] != str(invoice.id) for d in deadlines)


def test_permission_filters_sources(make_user, tenant, customer, line_items):
    _invoice_with_due(tenant, customer, line_items, due_offset_days=-3)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    deadlines = DeadlineService().upcoming(user=stranger, within_days=30)

    assert all(d["kind"] != "invoice_due" for d in deadlines)


def test_endpoint_returns_sorted_deadlines(auth_client, owner, tenant, customer, line_items):
    _invoice_with_due(tenant, customer, line_items, due_offset_days=10)
    _invoice_with_due(tenant, customer, line_items, due_offset_days=-1)

    response = auth_client(owner).get("/api/v1/deadlines/?days=30")

    assert response.status_code == 200, response.data
    rows = response.data
    due_dates = [r["due_date"] for r in rows]
    assert due_dates == sorted(due_dates)


def test_notify_due_creates_notifications(owner, tenant, customer, line_items):
    from notifications.models import Notification

    _invoice_with_due(tenant, customer, line_items, due_offset_days=-2)

    sent = DeadlineService().notify_due(recipient=owner, within_days=7)

    assert sent >= 1
    assert Notification.objects.filter(recipient=owner, category="invoice_due").exists()

"""Invoice lifecycle — an orthogonal layer over the issued/cancelled register:
sent → paid, a due date, and a derived overdue/lifecycle stage. The register
status and the number are never touched.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from finance.backend.models.invoice import (
    InvoiceType,
    LifecycleStage,
    PaymentStatus,
)
from finance.backend.services.invoice import InvoiceService
from shared.exceptions import ConflictError

pytestmark = pytest.mark.django_db

BASE = "/api/v1/finance"


def _generate(tenant, customer, line_items, **overrides):
    kwargs = {
        "tenant": tenant,
        "invoice_type": InvoiceType.SALES,
        "invoice_date": date(2026, 7, 26),
        "customer": customer,
        "lines": line_items(),
    }
    kwargs.update(overrides)
    return InvoiceService().generate(**kwargs)


def test_new_invoice_starts_generated_and_unpaid(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    assert invoice.payment_status == PaymentStatus.UNPAID
    assert invoice.lifecycle_stage() == LifecycleStage.GENERATED
    assert invoice.is_overdue() is False


def test_mark_sent_then_paid(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    service = InvoiceService()

    service.mark_sent(invoice=invoice)
    assert invoice.sent_at is not None
    assert invoice.lifecycle_stage() == LifecycleStage.SENT

    service.mark_paid(invoice=invoice)
    assert invoice.payment_status == PaymentStatus.PAID
    assert invoice.paid_at is not None
    assert invoice.lifecycle_stage() == LifecycleStage.PAID


def test_overdue_is_derived_from_due_date(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    InvoiceService().set_due_date(invoice=invoice, due_date=date(2026, 7, 1))

    today = date(2026, 8, 1)
    assert invoice.is_overdue(today=today) is True
    assert invoice.lifecycle_stage(today=today) == LifecycleStage.OVERDUE


def test_paid_invoice_is_never_overdue(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    InvoiceService().set_due_date(invoice=invoice, due_date=date(2026, 7, 1))
    InvoiceService().mark_paid(invoice=invoice)

    assert invoice.is_overdue(today=date(2026, 8, 1)) is False
    assert invoice.lifecycle_stage(today=date(2026, 8, 1)) == LifecycleStage.PAID


def test_cancelled_invoice_has_no_lifecycle(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    InvoiceService().cancel(invoice=invoice, reason="error")

    assert invoice.lifecycle_stage() == LifecycleStage.CANCELLED
    with pytest.raises(ConflictError):
        InvoiceService().mark_paid(invoice=invoice)


def test_unmark_paid_reverses_payment(tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    service = InvoiceService()
    service.mark_paid(invoice=invoice)
    service.unmark_paid(invoice=invoice)

    assert invoice.payment_status == PaymentStatus.UNPAID
    assert invoice.paid_at is None


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #
def test_mark_paid_endpoint(auth_client, owner, tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)

    response = auth_client(owner).post(f"{BASE}/invoices/{invoice.id}/mark-paid/")

    assert response.status_code == 200, response.data
    body = response.data.get("data", response.data)
    assert body["payment_status"] == PaymentStatus.PAID
    assert body["lifecycle_stage"] == LifecycleStage.PAID


def test_set_due_date_endpoint_then_overdue_flag(auth_client, owner, tenant, customer, line_items):
    invoice = _generate(tenant, customer, line_items)
    due = (date.today() - timedelta(days=5)).isoformat()

    response = auth_client(owner).post(
        f"{BASE}/invoices/{invoice.id}/due-date/", {"due_date": due}, format="json"
    )

    assert response.status_code == 200, response.data
    body = response.data.get("data", response.data)
    assert body["is_overdue"] is True
    assert body["lifecycle_stage"] == LifecycleStage.OVERDUE


def test_lifecycle_endpoints_are_permission_gated(
    auth_client, make_user, tenant, customer, line_items
):
    invoice = _generate(tenant, customer, line_items)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    response = auth_client(stranger).post(f"{BASE}/invoices/{invoice.id}/mark-paid/")

    assert response.status_code == 403

from __future__ import annotations

import pytest

from purchase.backend.models import BillStatus, PurchaseBill

pytestmark = pytest.mark.django_db


@pytest.fixture
def processed_bill(db, tenant) -> PurchaseBill:
    return PurchaseBill.objects.create(
        tenant=tenant,
        seller_name="Vendor Inc.",
        purchase_date="2026-07-20",
        total_rate="150.00",
        currency="USD",
        document_url="https://storage.internal/a.pdf",
        status=BillStatus.PROCESSED,
        confidence_score=0.95,
    )


def test_owner_can_list_bills(auth_client, owner, processed_bill):
    resp = auth_client(owner).get("/api/v1/purchase/bills/")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


def test_stats_counts_by_status(auth_client, owner, processed_bill, tenant):
    PurchaseBill.objects.create(
        tenant=tenant,
        seller_name="Other Vendor",
        purchase_date="2026-07-18",
        total_rate="10.00",
        currency="USD",
        document_url="https://storage.internal/b.pdf",
        status=BillStatus.NEEDS_ATTENTION,
        confidence_score=0.45,
    )
    resp = auth_client(owner).get("/api/v1/purchase/bills/stats/")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body == {
        "processed": 1,
        "needs_attention": 1,
        "total": 2,
        "unpaid": 2,
    }


def test_insights_endpoint(auth_client, owner, processed_bill):
    resp = auth_client(owner).get("/api/v1/purchase/bills/insights/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "overview" in data
    assert "vendor_analysis" in data
    assert "gst_summary" in data


def test_update_bill_action(auth_client, owner, processed_bill):
    resp = auth_client(owner).patch(
        f"/api/v1/purchase/bills/{processed_bill.id}/update-bill/",
        {"seller_name": "Updated Vendor", "invoice_number": "INV-100"},
        format="json",
    )
    assert resp.status_code == 200
    processed_bill.refresh_from_db()
    assert processed_bill.seller_name == "Updated Vendor"
    assert processed_bill.invoice_number == "INV-100"


def test_mark_paid_sets_payment_status(auth_client, owner, processed_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json"
    )
    assert resp.status_code == 200
    processed_bill.refresh_from_db()
    assert processed_bill.payment_status == "paid"
    assert processed_bill.paid_at is not None


def test_mark_paid_twice_conflicts(auth_client, owner, processed_bill):
    auth_client(owner).post(
        f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json"
    )
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json"
    )
    assert resp.status_code == 409


def test_marking_paid_is_audited(auth_client, owner, processed_bill):
    auth_client(owner).post(
        f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json"
    )
    from audit.models import AuditLog

    assert AuditLog.objects.filter(action="purchase.bill.paid", module="purchase").exists()


def test_unmark_paid_reverses_payment_status(auth_client, owner, processed_bill):
    client = auth_client(owner)
    client.post(f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json")

    resp = client.post(
        f"/api/v1/purchase/bills/{processed_bill.id}/unmark-paid/", {}, format="json"
    )

    assert resp.status_code == 200
    processed_bill.refresh_from_db()
    assert processed_bill.payment_status == "unpaid"
    assert processed_bill.paid_at is None


def test_unmark_paid_on_already_unpaid_bill_conflicts(auth_client, owner, processed_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{processed_bill.id}/unmark-paid/", {}, format="json"
    )
    assert resp.status_code == 409


def test_unmarking_paid_is_audited(auth_client, owner, processed_bill):
    client = auth_client(owner)
    client.post(f"/api/v1/purchase/bills/{processed_bill.id}/mark-paid/", {}, format="json")
    client.post(f"/api/v1/purchase/bills/{processed_bill.id}/unmark-paid/", {}, format="json")

    from audit.models import AuditLog

    assert AuditLog.objects.filter(action="purchase.bill.unpaid", module="purchase").exists()

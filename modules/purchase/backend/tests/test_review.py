from __future__ import annotations

import pytest

from purchase.backend.models import BillStatus, PurchaseBill

pytestmark = pytest.mark.django_db


@pytest.fixture
def pending_bill(db, tenant) -> PurchaseBill:
    return PurchaseBill.objects.create(
        tenant=tenant,
        seller_name="Vendor Inc.",
        purchase_date="2026-07-20",
        total_rate="150.00",
        currency="USD",
        document_url="https://storage.internal/a.pdf",
    )


def test_owner_can_list_bills(auth_client, owner, pending_bill):
    resp = auth_client(owner).get("/api/v1/purchase/bills/")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


def test_stats_counts_by_status(auth_client, owner, pending_bill, tenant):
    PurchaseBill.objects.create(
        tenant=tenant,
        seller_name="Other Vendor",
        purchase_date="2026-07-18",
        total_rate="10.00",
        currency="USD",
        document_url="https://storage.internal/b.pdf",
        status=BillStatus.CONFIRMED,
    )
    resp = auth_client(owner).get("/api/v1/purchase/bills/stats/")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body == {
        "pending_review": 1,
        "confirmed": 1,
        "rejected": 0,
        "total": 2,
        "unpaid_confirmed": 1,
        "overdue_pending": 0,
    }


def test_confirm_sets_status_and_vendor(auth_client, owner, pending_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/confirm/",
        {"vendor_name": "Vendor Inc."},
        format="json",
    )
    assert resp.status_code == 200
    pending_bill.refresh_from_db()
    assert pending_bill.status == BillStatus.CONFIRMED
    assert pending_bill.vendor is not None
    assert pending_bill.vendor.name == "Vendor Inc."
    assert pending_bill.reviewed_by_id == owner.id


def test_reject_requires_a_reason(auth_client, owner, pending_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/reject/", {}, format="json"
    )
    assert resp.status_code == 422


def test_reject_sets_status_and_reason(auth_client, owner, pending_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/reject/",
        {"reason": "Duplicate of an earlier bill"},
        format="json",
    )
    assert resp.status_code == 200
    pending_bill.refresh_from_db()
    assert pending_bill.status == BillStatus.REJECTED
    assert pending_bill.rejection_reason == "Duplicate of an earlier bill"


def test_cannot_review_an_already_reviewed_bill(auth_client, owner, pending_bill):
    auth_client(owner).post(f"/api/v1/purchase/bills/{pending_bill.id}/confirm/", {}, format="json")
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/reject/",
        {"reason": "too late"},
        format="json",
    )
    assert resp.status_code == 409


def test_operator_without_owner_role_is_denied(auth_client, tenant):
    from users.models import User

    bystander = User.objects.create_user(
        email="bystander@acme.test",
        username="bystander",
        password="Str0ng!Pass1",
        tenant=tenant,
        status="active",
    )
    resp = auth_client(bystander).get("/api/v1/purchase/bills/")
    assert resp.status_code == 403


def test_confirming_a_bill_is_audited(auth_client, owner, pending_bill):
    auth_client(owner).post(f"/api/v1/purchase/bills/{pending_bill.id}/confirm/", {}, format="json")
    from audit.models import AuditLog

    assert AuditLog.objects.filter(action="purchase.bill.confirmed", module="purchase").exists()


def test_mark_paid_requires_confirmed_bill(auth_client, owner, pending_bill):
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/mark-paid/", {}, format="json"
    )
    assert resp.status_code == 409


def test_mark_paid_sets_payment_status(auth_client, owner, pending_bill):
    auth_client(owner).post(f"/api/v1/purchase/bills/{pending_bill.id}/confirm/", {}, format="json")
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/mark-paid/", {}, format="json"
    )
    assert resp.status_code == 200
    pending_bill.refresh_from_db()
    assert pending_bill.payment_status == "paid"
    assert pending_bill.paid_at is not None


def test_mark_paid_twice_conflicts(auth_client, owner, pending_bill):
    auth_client(owner).post(f"/api/v1/purchase/bills/{pending_bill.id}/confirm/", {}, format="json")
    auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/mark-paid/", {}, format="json"
    )
    resp = auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/mark-paid/", {}, format="json"
    )
    assert resp.status_code == 409


def test_marking_paid_is_audited(auth_client, owner, pending_bill):
    auth_client(owner).post(f"/api/v1/purchase/bills/{pending_bill.id}/confirm/", {}, format="json")
    auth_client(owner).post(
        f"/api/v1/purchase/bills/{pending_bill.id}/mark-paid/", {}, format="json"
    )
    from audit.models import AuditLog

    assert AuditLog.objects.filter(action="purchase.bill.paid", module="purchase").exists()


def test_recent_excludes_pending_and_orders_by_reviewed_at(
    auth_client, owner, pending_bill, tenant
):
    rejected = PurchaseBill.objects.create(
        tenant=tenant,
        seller_name="Later Vendor",
        purchase_date="2026-07-19",
        total_rate="20.00",
        currency="USD",
        document_url="https://storage.internal/c.pdf",
    )
    auth_client(owner).post(
        f"/api/v1/purchase/bills/{rejected.id}/reject/", {"reason": "dup"}, format="json"
    )

    resp = auth_client(owner).get("/api/v1/purchase/bills/recent/")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body) == 1
    assert body[0]["id"] == str(rejected.id)

from __future__ import annotations

from datetime import timedelta

import pytest
from audit.models import AuditLog
from django.utils import timezone

from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_registration_generates_audit_record(api):
    api.post(
        "/api/v1/auth/register/",
        {"email": "audit@acme.test", "username": "audited", "password": PASSWORD},
        format="json",
    )
    assert AuditLog.objects.filter(action="user.created").exists()


def test_login_generates_audit_record(api, make_user):
    make_user(email="a@acme.test", username="a")
    api.post("/api/v1/auth/login/", {"email": "a@acme.test", "password": PASSWORD}, format="json")
    assert AuditLog.objects.filter(action="user.logged_in").exists()


def test_audit_records_are_immutable(db):
    entry = AuditLog.objects.create(action="user.created", module="users")

    with pytest.raises(ValueError):
        entry.action = "tampered"
        entry.save(update_fields=["action"])

    with pytest.raises(ValueError):
        entry.delete()


def test_audit_records_can_be_archived(db):
    entry = AuditLog.objects.create(action="user.created", module="users")
    entry.archive()
    entry.refresh_from_db()
    assert entry.archived is True


def test_api_filters_by_date_range(tenant, make_user, owner_role, grant, auth_client):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    old = AuditLog.objects.create(tenant=tenant, action="bill.created", module="purchase")
    AuditLog.objects.filter(id=old.id).update(created_at=timezone.now() - timedelta(days=10))
    recent = AuditLog.objects.create(tenant=tenant, action="bill.paid", module="purchase")

    cutoff = (timezone.now() - timedelta(days=1)).date().isoformat()
    response = auth_client(user).get(f"/api/v1/audit/?created_at__gte={cutoff}")
    ids = {row["id"] for row in response.data["data"]}
    assert str(recent.id) in ids
    assert str(old.id) not in ids


def test_api_filters_by_object_cross_reference(tenant, make_user, owner_role, grant, auth_client):
    user = make_user(email="owner2@acme.test", username="owner2", tenant=tenant)
    grant(user, owner_role)
    matching_a = AuditLog.objects.create(
        tenant=tenant, action="bill.created", module="purchase", object_type="PurchaseBill", object_id="1"
    )
    matching_b = AuditLog.objects.create(
        tenant=tenant, action="bill.paid", module="purchase", object_type="PurchaseBill", object_id="1"
    )
    AuditLog.objects.create(
        tenant=tenant, action="bill.created", module="purchase", object_type="PurchaseBill", object_id="2"
    )

    response = auth_client(user).get("/api/v1/audit/?object_type=PurchaseBill&object_id=1")
    ids = {row["id"] for row in response.data["data"]}
    assert ids == {str(matching_a.id), str(matching_b.id)}


def test_api_filters_by_module_in(tenant, make_user, owner_role, grant, auth_client):
    user = make_user(email="owner3@acme.test", username="owner3", tenant=tenant)
    grant(user, owner_role)
    purchase_entry = AuditLog.objects.create(tenant=tenant, action="bill.created", module="purchase")
    AuditLog.objects.create(tenant=tenant, action="user.logged_in", module="users")

    response = auth_client(user).get("/api/v1/audit/?module__in=purchase,assets")
    ids = {row["id"] for row in response.data["data"]}
    assert ids == {str(purchase_entry.id)}

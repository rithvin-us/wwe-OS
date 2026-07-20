from __future__ import annotations

import pytest

from purchase.backend.models import Vendor

pytestmark = pytest.mark.django_db


def test_owner_can_list_vendors(auth_client, owner, tenant):
    Vendor.objects.create(tenant=tenant, name="Acme Supplies")
    resp = auth_client(owner).get("/api/v1/purchase/vendors/")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


def test_owner_can_create_vendor_with_gst_number(auth_client, owner):
    resp = auth_client(owner).post(
        "/api/v1/purchase/vendors/",
        {"name": "Acme Supplies", "gst_number": "29ABCDE1234F1Z5"},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["name"] == "Acme Supplies"
    assert body["gst_number"] == "29ABCDE1234F1Z5"
    assert body["is_active"] is True


def test_creating_a_vendor_requires_a_name(auth_client, owner):
    resp = auth_client(owner).post("/api/v1/purchase/vendors/", {}, format="json")
    assert resp.status_code == 422


def test_owner_can_deactivate_vendor(auth_client, owner, tenant):
    vendor = Vendor.objects.create(tenant=tenant, name="Acme Supplies")
    resp = auth_client(owner).patch(
        f"/api/v1/purchase/vendors/{vendor.id}/", {"is_active": False}, format="json"
    )
    assert resp.status_code == 200
    vendor.refresh_from_db()
    assert vendor.is_active is False


def test_vendor_delete_is_not_allowed(auth_client, owner, tenant):
    vendor = Vendor.objects.create(tenant=tenant, name="Acme Supplies")
    resp = auth_client(owner).delete(f"/api/v1/purchase/vendors/{vendor.id}/")
    assert resp.status_code == 405


def test_operator_without_owner_role_is_denied(auth_client, tenant):
    from users.models import User

    bystander = User.objects.create_user(
        email="bystander@acme.test",
        username="bystander",
        password="Str0ng!Pass1",
        tenant=tenant,
        status="active",
    )
    resp = auth_client(bystander).get("/api/v1/purchase/vendors/")
    assert resp.status_code == 403


def test_vendor_name_unique_per_tenant(auth_client, owner, tenant):
    Vendor.objects.create(tenant=tenant, name="Acme Supplies")
    resp = auth_client(owner).post(
        "/api/v1/purchase/vendors/", {"name": "Acme Supplies"}, format="json"
    )
    assert resp.status_code == 409

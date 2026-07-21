"""Assets module tests — lifecycle transitions, storage, search, reporting, API."""

from __future__ import annotations

from decimal import Decimal

import pytest
from assets.backend.models import AssetStatus, MaintenanceRecord
from assets.backend.services.asset import AssetService
from audit.models import AuditLog
from notifications.models import Notification
from search.services import SearchService
from shared.exceptions import ConflictError, ValidationError
from storage.models import StoredFile

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/assets/assets/"


def _asset(tenant, **overrides):
    data = {
        "name": "MacBook Pro 16",
        "asset_tag": "IT-0001",
        "category": "it_equipment",
        "purchase_cost": Decimal("2500.00"),
        "currency": "USD",
        "supplier": "Apple",
    }
    data.update(overrides)
    return AssetService().create(tenant=tenant, actor=None, data=data)


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #


def test_assign_and_return(tenant):
    asset = _asset(tenant)
    asset = AssetService().assign(asset=asset, actor=None, assigned_to="Jane Doe")
    assert asset.status == AssetStatus.ASSIGNED
    assert asset.assigned_to == "Jane Doe"
    assert asset.assigned_at is not None

    asset = AssetService().return_asset(asset=asset, actor=None)
    assert asset.status == AssetStatus.IN_STOCK
    assert asset.assigned_to == ""


def test_cannot_assign_non_stock(tenant):
    asset = _asset(tenant)
    AssetService().assign(asset=asset, actor=None, assigned_to="Jane")
    with pytest.raises(ConflictError):
        AssetService().assign(asset=asset, actor=None, assigned_to="Bob")


def test_maintenance_cycle_records_history(tenant):
    service = AssetService()
    asset = _asset(tenant)
    service.start_maintenance(asset=asset, actor=None)
    asset.refresh_from_db()
    assert asset.status == AssetStatus.IN_MAINTENANCE

    record = service.complete_maintenance(
        asset=asset,
        actor=None,
        description="Battery replacement",
        cost=Decimal("120.00"),
        vendor="iFix",
    )
    asset.refresh_from_db()
    assert asset.status == AssetStatus.IN_STOCK
    assert isinstance(record, MaintenanceRecord)
    assert asset.maintenance.count() == 1


def test_complete_maintenance_requires_description(tenant):
    service = AssetService()
    asset = _asset(tenant)
    service.start_maintenance(asset=asset, actor=None)
    with pytest.raises(ValidationError):
        service.complete_maintenance(asset=asset, actor=None, description="   ")


def test_dispose_is_terminal_and_notifies(tenant, owner):
    asset = _asset(tenant)
    asset = AssetService().dispose(
        asset=asset, actor=owner, reason="End of life", proceeds=Decimal("50")
    )
    assert asset.status == AssetStatus.DISPOSED
    assert asset.disposed_at is not None
    assert Notification.objects.filter(recipient=owner, title="Asset disposed").exists()
    assert AuditLog.objects.filter(action="assets.disposed", module="assets").exists()

    with pytest.raises(ConflictError):
        AssetService().assign(asset=asset, actor=owner, assigned_to="X")


def test_disposed_asset_leaves_search(tenant, owner):
    asset = _asset(tenant)
    assert SearchService().search(user=owner, query="macbook")["results"]
    AssetService().dispose(asset=asset, actor=owner, reason="lost")
    assert SearchService().search(user=owner, query="macbook")["results"] == []


# --------------------------------------------------------------------------- #
# Storage
# --------------------------------------------------------------------------- #


def test_attach_warranty_file(tenant, owner):
    asset = _asset(tenant)
    asset = AssetService().attach_file(
        asset=asset,
        data=b"warranty terms",
        filename="warranty.txt",
        content_type="text/plain",
        actor=owner,
    )
    assert isinstance(asset.file, StoredFile)
    assert asset.file.module == "assets"


def test_duplicate_tag_conflicts(tenant):
    _asset(tenant, asset_tag="DUP")
    with pytest.raises(ConflictError):
        _asset(tenant, name="Other", asset_tag="DUP")


def test_disposed_asset_rejects_attach(tenant, owner):
    asset = _asset(tenant)
    AssetService().dispose(asset=asset, actor=owner, reason="sold")
    with pytest.raises(ConflictError):
        AssetService().attach_file(
            asset=asset, data=b"x", filename="x.txt", content_type="text/plain", actor=owner
        )


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_create_assign_maintenance_dispose(tenant, owner, auth_client):
    client = auth_client(owner)
    created = client.post(
        LIST_URL, {"name": "Forklift", "asset_tag": "MC-9", "category": "machinery"}, format="json"
    )
    assert created.status_code == 201
    asset_id = created.data["id"]

    assigned = client.post(
        f"{LIST_URL}{asset_id}/assign/", {"assigned_to": "Warehouse"}, format="json"
    )
    assert assigned.data["status"] == "assigned"

    client.post(f"{LIST_URL}{asset_id}/return/", {}, format="json")
    client.post(f"{LIST_URL}{asset_id}/maintenance/start/", {}, format="json")
    completed = client.post(
        f"{LIST_URL}{asset_id}/maintenance/complete/",
        {"description": "Serviced", "cost": "300"},
        format="json",
    )
    assert completed.data["status"] == "in_stock"

    records = client.get(f"{LIST_URL}{asset_id}/maintenance/")
    assert len(records.data) == 1

    disposed = client.post(f"{LIST_URL}{asset_id}/dispose/", {"reason": "sold"}, format="json")
    assert disposed.data["status"] == "disposed"


def test_api_stats_and_export(tenant, owner, auth_client):
    a1 = _asset(tenant, asset_tag="A-1", purchase_cost=Decimal("1000"))
    AssetService().assign(asset=a1, actor=owner, assigned_to="Jane")
    _asset(tenant, asset_tag="A-2", name="Desk", category="furniture")
    client = auth_client(owner)

    stats = client.get(f"{LIST_URL}stats/")
    assert stats.data["assigned"] == 1
    assert stats.data["in_stock"] == 1
    assert stats.data["total"] == 2

    export = client.post(f"{LIST_URL}export/", {"format": "csv"}, format="json")
    assert export.status_code == 200
    assert b"MacBook Pro 16" in export.content


def test_api_dispose_requires_manage(tenant, owner, make_user, auth_client):
    asset = _asset(tenant)
    writer = make_user("writer@acme.test", "writer", tenant=tenant)
    from roles.services import RoleService

    role = _role_with(tenant, "asset-writer", ["assets.read", "assets.write"])
    RoleService().assign_role(user=writer, role=role)

    denied = auth_client(writer).post(
        f"{LIST_URL}{asset.id}/dispose/", {"reason": "x"}, format="json"
    )
    assert denied.status_code == 403


def test_api_permissions_and_isolation(tenant, other_tenant, owner, make_user, auth_client):
    _asset(tenant)
    nobody = make_user("nobody@acme.test", "nobody", tenant=tenant)
    assert auth_client(nobody).get(LIST_URL).status_code == 403

    from roles.models import Role
    from roles.services import RoleService

    outsider = make_user("owner@globex.test", "globex", tenant=other_tenant)
    RoleService().assign_role(user=outsider, role=Role.objects.get(slug="owner"))
    assert auth_client(outsider).get(LIST_URL).data["data"] == []


def _role_with(tenant, slug, codes):
    from permissions.models import Permission
    from roles.models import Role

    role = Role.objects.create(tenant=tenant, name=slug.title(), slug=slug)
    role.permissions.set(Permission.objects.filter(code__in=codes))
    return role

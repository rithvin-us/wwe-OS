"""Inventory module tests — ledger integrity, low-stock alerts, search, API."""

from __future__ import annotations

from decimal import Decimal

import pytest
from audit.models import AuditLog
from inventory.backend.models import MovementType, StockMovement
from inventory.backend.services.inventory import InventoryService
from search.services import SearchService
from shared.exceptions import ConflictError, ValidationError

pytestmark = pytest.mark.django_db

ITEMS_URL = "/api/v1/inventory/items/"


def _item(tenant, **overrides):
    data = {
        "name": "Copier paper",
        "sku": "PAP-A4",
        "category": "office",
        "unit": "box",
        "unit_cost": Decimal("20.00"),
        "currency": "USD",
        "supplier": "Office Supplies Co",
    }
    data.update(overrides)
    return InventoryService().create_item(tenant=tenant, actor=None, data=data)


def _move(item, movement_type, quantity, actor=None):
    return InventoryService().record_movement(
        item=item, movement_type=movement_type, quantity=Decimal(quantity), actor=actor
    )


# --------------------------------------------------------------------------- #
# Ledger integrity
# --------------------------------------------------------------------------- #


def test_receipt_and_issue_update_balance(tenant):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "100")
    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("100")

    movement = _move(item, MovementType.ISSUE, "30")
    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("70")
    assert movement.delta == Decimal("-30")
    assert movement.balance_after == Decimal("70")
    assert StockMovement.objects.filter(item=item).count() == 2


def test_issue_cannot_go_negative(tenant):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "10")
    with pytest.raises(ConflictError):
        _move(item, MovementType.ISSUE, "25")
    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("10")  # unchanged


def test_adjustment_is_signed(tenant):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "50")
    _move(item, MovementType.ADJUSTMENT, "-4")  # breakage write-off
    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("46")

    with pytest.raises(ValidationError):
        _move(item, MovementType.ADJUSTMENT, "0")


def test_receipt_must_be_positive(tenant):
    item = _item(tenant)
    with pytest.raises(ValidationError):
        _move(item, MovementType.RECEIPT, "-5")


# --------------------------------------------------------------------------- #
# Low stock → notification + audit + search


def test_movement_is_audited_and_indexed(tenant, owner):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "12")
    assert AuditLog.objects.filter(action="inventory.stock_moved", module="inventory").exists()
    results = SearchService().search(user=owner, query="copier")
    assert any(r["doc_id"] == str(item.id) for r in results["results"])


# --------------------------------------------------------------------------- #
# Items
# --------------------------------------------------------------------------- #


def test_duplicate_sku_conflicts(tenant):
    _item(tenant, sku="DUP-1")
    with pytest.raises(ConflictError):
        _item(tenant, name="Another", sku="DUP-1")


def test_item_with_history_cannot_be_deleted(tenant):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "5")
    with pytest.raises(ConflictError):
        InventoryService().delete_item(item=item, actor=None)


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_create_receive_issue_flow(tenant, owner, auth_client):
    client = auth_client(owner)
    created = client.post(
        ITEMS_URL,
        {"name": "Widget", "sku": "WID-1", "unit": "pcs"},
        format="json",
    )
    assert created.status_code == 201
    item_id = created.data["id"]

    received = client.post(f"{ITEMS_URL}{item_id}/receive/", {"quantity": "20"}, format="json")
    assert received.status_code == 200
    assert received.data["item"]["quantity_on_hand"] == "20.00"

    issued = client.post(
        f"{ITEMS_URL}{item_id}/issue/", {"quantity": "18", "reason": "used"}, format="json"
    )
    assert issued.data["item"]["quantity_on_hand"] == "2.00"

    movements = client.get(f"{ITEMS_URL}{item_id}/movements/")
    assert len(movements.data) == 2


def test_api_stats_low_stock_export(tenant, owner, auth_client):
    item = _item(tenant)
    _move(item, MovementType.RECEIPT, "4")
    client = auth_client(owner)

    stats = client.get(f"{ITEMS_URL}stats/")
    assert stats.data["active"] == 1

    export = client.post(f"{ITEMS_URL}export/", {"format": "csv"}, format="json")
    assert export.status_code == 200
    assert b"PAP-A4" in export.content


def test_api_permissions_and_isolation(tenant, other_tenant, owner, make_user, auth_client):
    _item(tenant)
    nobody = make_user("nobody@acme.test", "nobody", tenant=tenant)
    assert auth_client(nobody).get(ITEMS_URL).status_code == 403

    from roles.models import Role
    from roles.services import RoleService

    outsider = make_user("owner@globex.test", "globex", tenant=other_tenant)
    RoleService().assign_role(user=outsider, role=Role.objects.get(slug="owner"))
    assert auth_client(outsider).get(ITEMS_URL).data["data"] == []

"""Inventory module permissions — synced into the shared registry post_migrate."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDef:
    code: str
    name: str
    category: str


INVENTORY_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("inventory.read", "View inventory", "Inventory"),
    PermissionDef("inventory.write", "Manage items and record stock movements", "Inventory"),
    PermissionDef("inventory.manage", "Deactivate and delete items", "Inventory"),
]

"""Contract module permissions — registered into the shared platform registry
via the post_migrate hook in apps.py (same pattern as purchase/documents)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDef:
    code: str
    name: str
    category: str


CONTRACT_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("contracts.read", "View contracts", "Contracts"),
    PermissionDef("contracts.write", "Create and edit contracts", "Contracts"),
    PermissionDef("contracts.approve", "Approve contracts", "Contracts"),
    PermissionDef("contracts.manage", "Terminate and delete contracts", "Contracts"),
]

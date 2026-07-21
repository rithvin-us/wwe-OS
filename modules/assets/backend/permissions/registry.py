"""Asset module permissions — synced into the shared registry post_migrate."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDef:
    code: str
    name: str
    category: str


ASSET_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("assets.read", "View assets", "Assets"),
    PermissionDef("assets.write", "Create, edit, assign, and service assets", "Assets"),
    PermissionDef("assets.manage", "Dispose and delete assets", "Assets"),
]

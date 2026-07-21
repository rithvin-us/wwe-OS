"""Document module permissions.

Registered into the platform's shared Permission table via the post_migrate
hook in apps.py — the exact pattern the purchase module uses. The platform
owns the RBAC mechanism; this module owns only its vocabulary.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDef:
    code: str
    name: str
    category: str


DOCUMENT_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("documents.read", "View documents", "Documents"),
    PermissionDef("documents.write", "Upload and edit documents", "Documents"),
    PermissionDef("documents.approve", "Approve documents", "Documents"),
    PermissionDef("documents.manage", "Archive and delete documents", "Documents"),
]

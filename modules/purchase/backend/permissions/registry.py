"""Purchase module's own permission vocabulary.

Synced into the shared Permission table by `purchase.backend.apps` on
migrate — the platform owns the mechanism (see platform/permissions), this
module owns these codes. Enforced the same way as any platform endpoint, via
`shared.permissions.HasPlatformPermission` and each view's
`required_permissions`.
"""

from __future__ import annotations

from permissions.registry import PermissionDef

PURCHASE_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("purchase.bill.read", "View purchase bills", "Purchase"),
    PermissionDef("purchase.bill.review", "Confirm or reject purchase bills", "Purchase"),
    PermissionDef("purchase.vendor.manage", "Manage vendors", "Purchase"),
]

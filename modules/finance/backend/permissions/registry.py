"""Finance module's own permission vocabulary.

Synced into the shared Permission table by `finance.backend.apps` on migrate —
the platform owns the mechanism (see platform/permissions), this module owns
these codes. Same pattern as purchase/assets.
"""

from __future__ import annotations

from permissions.registry import PermissionDef

FINANCE_PERMISSIONS: list[PermissionDef] = [
    PermissionDef("finance.invoice.read", "View invoices and the bill register", "Finance"),
    PermissionDef("finance.invoice.generate", "Generate and correct invoices", "Finance"),
    PermissionDef("finance.invoice.cancel", "Cancel a raised invoice", "Finance"),
    PermissionDef("finance.customer.manage", "Manage billing customers and sites", "Finance"),
]

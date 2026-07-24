"""Registers this module's document categories with platform/periods so
uploads land in a human-readable period/library path. One DocumentTypeDef
per DocumentCategory value — see
docs/superpowers/specs/2026-07-24-business-period-manager-design.md §3.

purchase_bill is registered identically here and in
purchase/backend/document_types.py so both modules' bills land in the
same "Purchase Bills" folder — register_document_type is last-write-wins
by key (periods/registry.py), so whichever app's ready() runs first wins;
both definitions must stay identical to avoid silent drift (see the
Subsystem 2 plan's regression-risk table).
"""

from __future__ import annotations

from documents.backend.models import DocumentCategory
from periods.registry import DocumentTypeDef, register_document_type

_FOLDER_SEGMENTS = {
    DocumentCategory.CONTRACT: "Contracts",
    DocumentCategory.INVOICE: "Invoices",
    DocumentCategory.POLICY: "Policies",
    DocumentCategory.PO: "Purchase Orders",
    DocumentCategory.REPORT: "Reports",
    DocumentCategory.PURCHASE_BILL: "Purchase Bills",
    DocumentCategory.CORRESPONDENCE: "Correspondence",
    DocumentCategory.OTHER: "Other",
}


def register_document_types() -> None:
    for category, folder_segment in _FOLDER_SEGMENTS.items():
        register_document_type(
            DocumentTypeDef(
                key=str(category),
                label=category.label,
                folder_segment=folder_segment,
                is_library=False,
                module="documents",
            )
        )

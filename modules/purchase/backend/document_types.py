"""Registers purchase_bill with platform/periods — identical definition to
documents/backend/document_types.py's entry for the same key, so both
modules' bills land in the same "Purchase Bills" folder.
register_document_type is last-write-wins by key (periods/registry.py);
whichever app's ready() runs first wins, and since both definitions are
authored identically, that's harmless. Keep them in sync if either
changes — see the Subsystem 2 plan's regression-risk table.
"""

from __future__ import annotations

from periods.registry import DocumentTypeDef, register_document_type


def register_document_types() -> None:
    register_document_type(
        DocumentTypeDef(
            key="purchase_bill",
            label="Purchase Bill",
            folder_segment="Purchase Bills",
            is_library=False,
            module="purchase",
        )
    )

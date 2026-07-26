"""Registers the two invoice document types with platform/periods.

This is what gives generated invoices their predictable folder structure:
`resolve_location` turns a (type, business date, tenant) into
`<tenant>/<year>/<Month>/<folder segment>/<file>` — so an AMC invoice raised
in July 2026 lands in `acme/2026/July/AMC Invoices/`. The module owns the
vocabulary; the platform owns the path shape.
"""

from __future__ import annotations

from periods.registry import DocumentTypeDef, register_document_type

AMC_INVOICE = "amc_invoice"
SALES_INVOICE = "sales_invoice"


def register_document_types() -> None:
    register_document_type(
        DocumentTypeDef(
            key=AMC_INVOICE,
            label="AMC Invoice",
            folder_segment="AMC Invoices",
            is_library=False,
            module="finance",
        )
    )
    register_document_type(
        DocumentTypeDef(
            key=SALES_INVOICE,
            label="Sales Invoice",
            folder_segment="Sales Invoices",
            is_library=False,
            module="finance",
        )
    )

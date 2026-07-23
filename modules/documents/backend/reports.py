"""Registers the document register into the platform report catalog."""

from __future__ import annotations

from documents.backend.models import Document
from documents.backend.services.document import TAG_MODULE, TAG_OBJECT_TYPE, DocumentService
from reporting.filtering import apply_date_range, apply_tag_filter
from reporting.registry import ReportDefinition, register_report


def _build(tenant, filters: dict):
    documents = Document.objects.filter(tenant=tenant)
    documents = apply_date_range(documents, filters, field="created_at")
    documents = apply_tag_filter(
        documents, filters, tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE
    )
    applied = {k: filters.get(k) for k in ("date_from", "date_to", "tag_ids")}
    return DocumentService().build_report_spec(documents=documents, filters=applied)


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="documents-register",
            label="Document register",
            module="documents",
            permission="documents.read",
            description="Every document with its category, status, and owner.",
            build_spec=_build,
        )
    )

"""Registers the document register into the platform report catalog."""

from __future__ import annotations

from documents.backend.models import Document
from documents.backend.services.document import DocumentService
from reporting.registry import ReportDefinition, register_report


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="documents-register",
            label="Document register",
            module="documents",
            permission="documents.read",
            description="Every document with its category, status, and owner.",
            build_spec=lambda tenant: DocumentService().build_report_spec(
                documents=Document.objects.filter(tenant=tenant)
            ),
        )
    )

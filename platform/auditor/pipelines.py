"""Auditor Package pipeline — two steps, one per document type, run on the
existing pipeline engine (platform/workflow, Subsystem 1). Reads
StoredFile directly; never imports documents/purchase (design §2a):
docs/superpowers/specs/2026-07-25-auditor-package-generator-design.md
"""

from __future__ import annotations

import calendar
from datetime import date

from periods.resolution import DocumentContext, resolve_location
from periods.services import PeriodService
from storage.models import StoredFile
from storage.services import StorageService
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)

from auditor.pdf import merge_pdfs

AUDITOR_PACKAGE_PIPELINE_KEY = "auditor.package.generate"


def _merge_category(ctx: StepContext, *, category: str, label: str) -> StepResult:
    year = ctx.data["year"]
    month = ctx.data["month"]
    files = list(
        StoredFile.objects.filter(
            tenant=ctx.tenant,
            category=category,
            period_year=year,
            period_month=month,
            content_type="application/pdf",
        )
    )
    if not files:
        return StepResult(output={"generated": False, "reason": "no_files"})

    streams = [StorageService().open(stored) for stored in files]
    merged = merge_pdfs(streams)

    month_name = calendar.month_name[month]
    document_name = f"{label}-{month_name}-{year}.pdf"
    resolved = resolve_location(
        DocumentContext(
            document_type="auditor_package",
            document_name=document_name,
            tenant_slug=ctx.tenant.slug,
            business_date=date(year, month, 1),
        )
    )
    stored_package = StorageService().store(
        data=merged,
        filename=document_name,
        content_type="application/pdf",
        module="auditor",
        category="auditor_package",
        tenant=ctx.tenant,
        key=resolved.key,
        period_year=resolved.period_year,
        period_month=resolved.period_month,
        is_library=resolved.is_library,
    )
    PeriodService().record_document(
        tenant=ctx.tenant, resolved=resolved, document_type="auditor_package"
    )
    return StepResult(
        output={"generated": True, "key": stored_package.key, "file_count": len(files)}
    )


def _merge_invoices(ctx: StepContext) -> StepResult:
    return _merge_category(ctx, category="invoice", label="Invoices")


def _merge_purchase_bills(ctx: StepContext) -> StepResult:
    return _merge_category(ctx, category="purchase_bill", label="PurchaseBills")


def register_auditor_pipeline() -> None:
    register_pipeline(
        PipelineDefinition(
            key=AUDITOR_PACKAGE_PIPELINE_KEY,
            label="Generate Auditor Package",
            module="auditor",
            permission="auditor.generate",
            version=1,
            steps=[
                StepDefinition(key="merge_invoices", label="Merge Invoices", run=_merge_invoices),
                StepDefinition(
                    key="merge_purchase_bills",
                    label="Merge Purchase Bills",
                    run=_merge_purchase_bills,
                ),
            ],
        )
    )

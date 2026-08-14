"""Auditor package pipeline — merge_invoices / merge_purchase_bills, run
through the real workflow engine (Subsystem 1), no bespoke execution
mechanism."""

from __future__ import annotations

import io

import pytest
from auditor.pipelines import AUDITOR_PACKAGE_PIPELINE_KEY
from periods.models import BusinessPeriod
from pypdf import PdfReader, PdfWriter
from storage.models import StoredFile
from storage.services import StorageService
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db


def _one_page_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _store_pdf(tenant, *, category, year=2026, month=7, filename="doc.pdf"):
    return StorageService().store(
        data=_one_page_pdf(),
        filename=filename,
        content_type="application/pdf",
        module="test",
        category=category,
        tenant=tenant,
        period_year=year,
        period_month=month,
    )


def _run(tenant, year=2026, month=7):
    run, _created = PipelineService().start(
        pipeline_key=AUDITOR_PACKAGE_PIPELINE_KEY,
        tenant=tenant,
        input_data={"year": year, "month": month},
    )
    return PipelineService().run_to_completion(run)


def test_generates_a_merged_invoice_package(tenant):
    _store_pdf(tenant, category="invoice", filename="inv1.pdf")
    _store_pdf(tenant, category="invoice", filename="inv2.pdf")

    run = _run(tenant)

    invoices_output = run.context["merge_invoices"]
    assert invoices_output["generated"] is True
    assert invoices_output["file_count"] == 2

    merged = StoredFile.objects.get(key=invoices_output["key"])
    assert merged.category == "auditor_package"
    assert merged.period_year == 2026
    assert merged.period_month == 7
    assert merged.is_library is False
    reader = PdfReader(io.BytesIO(StorageService().open(merged)))
    assert len(reader.pages) == 2


def test_generates_both_packages_when_both_types_present(tenant):
    _store_pdf(tenant, category="invoice")
    _store_pdf(tenant, category="purchase_bill")

    run = _run(tenant)

    assert run.context["merge_invoices"]["generated"] is True
    assert run.context["merge_purchase_bills"]["generated"] is True


def test_empty_period_generates_nothing_but_does_not_fail(tenant):
    run = _run(tenant)

    assert run.context["merge_invoices"] == {"generated": False, "reason": "no_files"}
    assert run.context["merge_purchase_bills"] == {"generated": False, "reason": "no_files"}
    assert run.status == "success"


def test_non_pdf_files_are_excluded_from_the_merge(tenant):
    StorageService().store(
        data=b"\xff\xd8\xff\xe0 not a pdf, a jpeg",
        filename="photo.jpg",
        content_type="image/jpeg",
        module="test",
        category="invoice",
        tenant=tenant,
        period_year=2026,
        period_month=7,
    )
    _store_pdf(tenant, category="invoice")

    run = _run(tenant)

    assert run.context["merge_invoices"]["file_count"] == 1


def test_rerunning_for_the_same_period_does_not_overwrite(tenant):
    _store_pdf(tenant, category="invoice")

    first = _run(tenant)
    second = _run(tenant)

    assert first.context["merge_invoices"]["key"] != second.context["merge_invoices"]["key"]
    assert StoredFile.objects.filter(category="auditor_package").count() == 2


def test_records_the_period_manifest(tenant):
    _store_pdf(tenant, category="invoice")

    _run(tenant)

    period = BusinessPeriod.objects.get(tenant=tenant, year=2026, month=7)
    assert period.manifest.document_counts.get("auditor_package") == 1

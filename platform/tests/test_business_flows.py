"""End-to-end business-flow tests — the production-hardening safety net.

These exercise the real capabilities the platform already ships, through their
real entry points, so a regression in any of the load-bearing flows fails
loudly and automatically (no manual verification needed):

* the storage service stores and returns bytes intact (Phase 2),
* documents are filed under a human-readable ``<year>/<Month>/<type>/`` tree
  (Phase 3),
* an invoice generates a real file in that tree and the number sequence never
  repeats (Phases 6.1–6.3),
* an automation pipeline records itemised, step-level run logs (Phases 4–5),
* the ``reset_demo_data`` command returns the system to an empty slate
  (Phase 7).

They intentionally call the same services the API and management commands call,
rather than re-testing HTTP plumbing the module suites already cover.
"""

from __future__ import annotations

from datetime import date

import pytest
from assets.backend.models import Asset
from automation.models import (
    AutomationRule,
    Cadence,
    Destination,
    RunStatus,
    TriggerType,
)
from automation.services import AutomationService
from django.core.management import call_command
from django.utils import timezone
from finance.backend.models.invoice import Invoice, InvoiceNumberSequence, InvoiceType
from finance.backend.services.invoice import InvoiceService
from periods.resolution import DocumentContext, resolve_location
from storage.providers import get_provider
from storage.services import StorageService
from tagging.services import TagService
from workflow.models import PipelineStepRun, StepRunStatus

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _finance_local_archive(settings):
    """Keep the invoice local archive inside the per-test storage root the
    platform conftest already redirects to ``tmp_path``, so generating an
    invoice never writes into the repo's real ``.storage``."""
    settings.STORAGE_BACKEND = "local"
    settings.INVOICE_LOCAL_ARCHIVE_PATH = settings.STORAGE_LOCAL_PATH


def _lines():
    return [
        {
            "description": "Pressure pump overhaul",
            "hsn": "998719",
            "quantity": 2,
            "uom": "Nos",
            "rate": "5000.00",
        }
    ]


def _generate_invoice(tenant, *, invoice_date=date(2026, 7, 26)):
    return InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=invoice_date,
        customer=None,
        consignee_name="Acme Water Works",
        consignee_address="1 Canal Road",
        lines=_lines(),
    )


# --------------------------------------------------------------------------- #
# Phase 2 — storage service round-trips bytes intact
# --------------------------------------------------------------------------- #
def test_storage_service_saves_and_returns_the_same_bytes(tenant):
    payload = b"%PDF-1.4 a real-enough document"
    stored = StorageService().store(
        data=payload,
        filename="report.pdf",
        content_type="application/pdf",
        module="reports",
        tenant=tenant,
    )

    assert get_provider().exists(stored.key)
    assert StorageService().open(stored) == payload
    assert StorageService().verify_integrity(stored) is True


# --------------------------------------------------------------------------- #
# Phase 3 — files land under a readable <year>/<Month>/<type>/ tree
# --------------------------------------------------------------------------- #
def test_documents_are_filed_under_a_human_readable_month_and_type(tenant):
    resolved = resolve_location(
        DocumentContext(
            document_type="purchase_bill",
            document_name="bill.pdf",
            tenant_slug=tenant.slug,
            business_date=date(2026, 7, 15),
            source_channel="test",
        )
    )
    # e.g. "acme/2026/July/Purchase Bills/bill.pdf" — readable month, not "07".
    assert resolved.key == f"{tenant.slug}/2026/July/Purchase Bills/bill.pdf"
    assert resolved.period_year == 2026
    assert resolved.period_month == 7


# --------------------------------------------------------------------------- #
# Phase 6.1/6.2 — invoice generation produces a real file in the tree
# --------------------------------------------------------------------------- #
def test_invoice_generation_creates_a_stored_file_in_its_period_folder(tenant, settings):
    invoice = _generate_invoice(tenant)

    # A register row with both artifacts attached.
    assert invoice.file is not None and invoice.pdf_file is not None
    # The bytes really exist in the object store and on the local archive.
    assert get_provider().exists(invoice.file.key)
    from pathlib import Path

    assert Path(invoice.local_path).is_file()
    # Filed under the readable Sales-invoice folder for July 2026.
    assert "/2026/July/Sales Invoices/" in f"/{invoice.file.key}"
    assert invoice.file.period_year == 2026 and invoice.file.period_month == 7


# --------------------------------------------------------------------------- #
# Phase 6.3 — the number sequence increments and never repeats
# --------------------------------------------------------------------------- #
def test_invoice_numbers_increment_and_never_repeat(tenant):
    first = _generate_invoice(tenant)
    second = _generate_invoice(tenant)

    assert second.sequence_number == first.sequence_number + 1
    assert first.number != second.number
    assert Invoice.objects.filter(tenant=tenant).count() == 2


# --------------------------------------------------------------------------- #
# Phases 4–5 — an automation run records itemised, step-level logs
# --------------------------------------------------------------------------- #
@pytest.fixture
def tagged_asset(tenant):
    tag = TagService().create_tag(tenant=tenant, name="For Auditor")
    stored = StorageService().store(
        data=b"warranty pdf bytes",
        filename="warranty.pdf",
        content_type="application/pdf",
        module="assets",
        category="asset-file",
        tenant=tenant,
    )
    asset = Asset.objects.create(tenant=tenant, name="Laptop", asset_tag="AST-1", file=stored)
    TagService().set_tags_for_object(
        tenant=tenant,
        module="assets",
        object_type="Asset",
        object_id=str(asset.id),
        tag_ids=[str(tag.id)],
    )
    return asset, tag


def test_automation_run_records_itemised_and_step_level_logs(tenant, tagged_asset):
    _asset, tag = tagged_asset
    rule = AutomationRule.objects.create(
        tenant=tenant,
        name="Auditor bundle",
        source_modules=["assets"],
        required_tags=[str(tag.id)],
        destination=Destination.DOWNLOADED_PACKAGE,
        cadence=Cadence.ONCE,
        next_run_at=timezone.now(),
    )

    run = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    # The run log itemises exactly what left the building, with an output file.
    assert run.status == RunStatus.SUCCESS, run.error_message
    assert run.item_count == 1
    assert run.items[0]["included"] is True
    assert run.output_file is not None

    # The underlying workflow pipeline logged a successful step run.
    pipeline_run = run.pipeline_run
    assert pipeline_run is not None
    assert pipeline_run.status == "success"
    steps = PipelineStepRun.objects.filter(run=pipeline_run)
    assert steps.exists()
    assert all(s.status == StepRunStatus.SUCCESS for s in steps)


# --------------------------------------------------------------------------- #
# Phase 7 — reset_demo_data returns the system to an empty slate
# --------------------------------------------------------------------------- #
def test_reset_demo_data_clears_invoices_counters_and_files(tenant, settings):
    invoice = _generate_invoice(tenant)
    key = invoice.file.key
    assert get_provider().exists(key)
    assert InvoiceNumberSequence.objects.filter(tenant=tenant).exists()

    call_command("reset_demo_data", "--force", "--no-input")

    # Invoices and their counter rows are gone → numbering restarts at 1.
    assert Invoice.all_objects.filter(tenant=tenant).count() == 0
    assert InvoiceNumberSequence.all_objects.filter(tenant=tenant).count() == 0
    # The bytes on disk were wiped with the storage root.
    assert not get_provider().exists(key)
    # A fresh invoice starts the sequence over at 1.
    fresh = _generate_invoice(tenant)
    assert fresh.sequence_number == 1

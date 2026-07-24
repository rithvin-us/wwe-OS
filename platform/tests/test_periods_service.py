"""PeriodService — the DB-touching side: period rows, manifest cache
(always recomputed from a live StoredFile aggregate, never a running
counter), and lifecycle status."""

from __future__ import annotations

import pytest
from periods.models import BusinessPeriod, PeriodManifest, PeriodStatus
from periods.resolution import ResolvedLocation
from periods.services import PeriodService
from shared.exceptions import ValidationError
from storage.services import StorageService

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4 fake but good enough"


def _rotating(year=2026, month=7):
    return ResolvedLocation(
        key=f"acme/{year}/M/Invoices/invoice.pdf",
        period_year=year,
        period_month=month,
        is_library=False,
    )


def _library():
    return ResolvedLocation(
        key="acme/Library/Insurance/policy.pdf",
        period_year=None,
        period_month=None,
        is_library=True,
    )


def test_get_or_create_period_is_idempotent(tenant):
    first = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)
    second = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)

    assert first.id == second.id
    assert BusinessPeriod.objects.filter(tenant=tenant, year=2026, month=7).count() == 1


def test_record_document_creates_period_and_manifest(tenant):
    PeriodService().record_document(tenant=tenant, resolved=_rotating(), document_type="invoice")

    period = BusinessPeriod.objects.get(tenant=tenant, year=2026, month=7)
    manifest = PeriodManifest.objects.get(period=period)
    assert manifest.total_count == 0  # no StoredFile actually stored yet in this test
    assert manifest.document_counts == {}


def test_record_document_noops_for_library_location(tenant):
    PeriodService().record_document(tenant=tenant, resolved=_library(), document_type="insurance")

    assert BusinessPeriod.objects.filter(tenant=tenant).count() == 0
    assert PeriodManifest.objects.count() == 0


def test_refresh_manifest_recomputes_from_live_storedfile_aggregate(tenant):
    period = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)
    stored = StorageService().store(
        data=PDF,
        filename="invoice.pdf",
        content_type="application/pdf",
        module="documents",
        tenant=tenant,
        category="invoice",
        key="acme/2026/July/Invoices/invoice.pdf",
        period_year=2026,
        period_month=7,
    )

    manifest = PeriodService().refresh_manifest(period=period)
    assert manifest.document_counts == {"invoice": 1}
    assert manifest.total_count == 1

    # Deleting the file and refreshing again must reflect reality — the
    # manifest is a cache, not an independently-trusted counter.
    stored.delete()
    manifest = PeriodService().refresh_manifest(period=period)
    assert manifest.document_counts == {}
    assert manifest.total_count == 0


def test_list_periods_is_tenant_scoped_and_ordered(tenant, other_tenant):
    PeriodService().get_or_create_period(tenant=tenant, year=2026, month=5)
    PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)
    PeriodService().get_or_create_period(tenant=other_tenant, year=2026, month=6)

    periods = PeriodService().list_periods(tenant=tenant)
    assert [(p.year, p.month) for p in periods] == [(2026, 7), (2026, 5)]


def test_set_status_records_transition(tenant):
    period = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)

    updated = PeriodService().set_status(period=period, status=PeriodStatus.CLOSING)

    assert updated.status == PeriodStatus.CLOSING
    period.refresh_from_db()
    assert period.status == PeriodStatus.CLOSING


def test_set_status_rejects_unknown_status(tenant):
    period = PeriodService().get_or_create_period(tenant=tenant, year=2026, month=7)

    with pytest.raises(ValidationError):
        PeriodService().set_status(period=period, status="not-a-real-status")

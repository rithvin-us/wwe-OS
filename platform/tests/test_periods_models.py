"""Business period models — uniqueness, defaults, tenant isolation."""

from __future__ import annotations

import pytest
from django.db import IntegrityError
from periods.models import BusinessPeriod, PeriodManifest, PeriodStatus

pytestmark = pytest.mark.django_db


def test_year_month_unique_per_tenant(tenant):
    BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)
    with pytest.raises(IntegrityError):
        BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)


def test_default_status_is_open(tenant):
    period = BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)
    assert period.status == PeriodStatus.OPEN


def test_manifest_defaults_to_empty(tenant):
    period = BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)
    manifest = PeriodManifest.objects.create(tenant=tenant, period=period)
    assert manifest.document_counts == {}
    assert manifest.total_count == 0


def test_manifest_is_one_to_one_with_period(tenant):
    period = BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)
    PeriodManifest.objects.create(tenant=tenant, period=period)
    with pytest.raises(IntegrityError):
        PeriodManifest.objects.create(tenant=tenant, period=period)


def test_two_tenants_same_year_month_do_not_collide(tenant, other_tenant):
    BusinessPeriod.objects.create(tenant=tenant, year=2026, month=7)
    BusinessPeriod.objects.create(tenant=other_tenant, year=2026, month=7)
    assert BusinessPeriod.objects.filter(year=2026, month=7).count() == 2

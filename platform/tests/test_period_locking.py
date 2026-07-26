"""Period locking — the write-guard behind a submitted month.

Migrated from the legacy HR app's PeriodLock (docs/specs/hr-migration.md § 4):
locking a business month is a platform capability, so it lives here rather than
in the module that happens to need it first.
"""

from __future__ import annotations

import pytest
from periods.models import BusinessPeriod, PeriodStatus
from periods.services import PeriodService
from shared.exceptions import ConflictError, ValidationError

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor(make_user, tenant):
    return make_user(email="operator@acme.test", username="operator", tenant=tenant)


class TestLockUnlock:
    def test_a_period_that_was_never_created_is_open(self, tenant):
        # Absence of a row is not a lock.
        assert PeriodService().is_locked(tenant=tenant, year=2026, month=4) is False
        PeriodService().assert_open(tenant=tenant, year=2026, month=4)

    def test_lock_closes_the_period(self, tenant, actor):
        period = PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        assert period.is_locked is True
        assert period.locked_at is not None
        assert period.locked_by == actor
        assert period.status == PeriodStatus.CLOSED
        assert period.closed_at == period.locked_at

    def test_locking_is_idempotent(self, tenant, actor):
        first = PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)
        second = PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        assert first.pk == second.pk
        assert second.locked_at == first.locked_at
        assert BusinessPeriod.objects.filter(tenant=tenant, year=2026, month=4).count() == 1

    def test_assert_open_raises_once_locked(self, tenant, actor):
        PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        with pytest.raises(ConflictError):
            PeriodService().assert_open(tenant=tenant, year=2026, month=4)

    def test_unlock_requires_a_reason(self, tenant, actor):
        PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        with pytest.raises(ValidationError):
            PeriodService().unlock(tenant=tenant, year=2026, month=4, reason="   ", actor=actor)

        # Still locked — a rejected unlock must not half-apply.
        assert PeriodService().is_locked(tenant=tenant, year=2026, month=4) is True

    def test_unlock_reopens_and_keeps_the_reason(self, tenant, actor):
        PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        period = PeriodService().unlock(
            tenant=tenant, year=2026, month=4, reason="Inspector queried Form B", actor=actor
        )

        assert period.is_locked is False
        assert period.unlock_reason == "Inspector queried Form B"
        assert period.unlocked_at is not None
        assert period.unlocked_by == actor
        assert period.status == PeriodStatus.OPEN
        assert period.closed_at is None
        PeriodService().assert_open(tenant=tenant, year=2026, month=4)

    def test_locks_are_per_tenant_and_per_month(self, tenant, other_tenant, actor):
        PeriodService().lock(tenant=tenant, year=2026, month=4, actor=actor)

        # A neighbouring month is unaffected.
        PeriodService().assert_open(tenant=tenant, year=2026, month=5)
        # Another tenant's same month is unaffected.
        PeriodService().assert_open(tenant=other_tenant, year=2026, month=4)

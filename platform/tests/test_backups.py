"""The backup dashboard is honest: an area with no successful run is reported as
'not configured' (never 'healthy'), a completed run is not called 'verified'
until a restore test sets verified_at, and storage usage is the real StoredFile
total. This app records backup activity; it never performs or fakes backups.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from backups.models import BackupKind, BackupStatus
from backups.services import BackupService
from django.utils import timezone

pytestmark = pytest.mark.django_db


def _by_kind(summary):
    return {a["kind"]: a for a in summary["areas"]}


def test_area_with_no_runs_is_not_configured(make_user, tenant):
    user = make_user(tenant=tenant)

    areas = _by_kind(BackupService().summary(user=user))

    assert areas[BackupKind.DATABASE]["configured"] is False
    assert areas[BackupKind.DATABASE]["status"] == "not_configured"
    assert areas[BackupKind.DATABASE]["verified"] is False


def test_recent_success_is_healthy_but_unverified(make_user, tenant):
    user = make_user(tenant=tenant)
    BackupService().record(
        kind=BackupKind.DATABASE, status=BackupStatus.SUCCESS, started_at=timezone.now()
    )

    area = _by_kind(BackupService().summary(user=user))[BackupKind.DATABASE]

    assert area["configured"] is True
    assert area["status"] == "healthy"
    # Completing is not the same as being restore-tested.
    assert area["verified"] is False


def test_only_a_restore_test_marks_verified(make_user, tenant):
    user = make_user(tenant=tenant)
    BackupService().record(
        kind=BackupKind.DATABASE,
        status=BackupStatus.SUCCESS,
        started_at=timezone.now(),
        verified=True,
    )

    area = _by_kind(BackupService().summary(user=user))[BackupKind.DATABASE]

    assert area["verified"] is True


def test_old_success_is_flagged_stale(make_user, tenant):
    user = make_user(tenant=tenant)
    BackupService().record(
        kind=BackupKind.DATABASE,
        status=BackupStatus.SUCCESS,
        started_at=timezone.now() - timedelta(days=3),
    )

    area = _by_kind(BackupService().summary(user=user))[BackupKind.DATABASE]

    assert area["status"] == "stale"


def test_storage_usage_reflects_stored_files(make_user, tenant):
    from storage.models import ScanStatus, StoredFile

    user = make_user(tenant=tenant)
    StoredFile.objects.create(
        tenant=tenant,
        key="k1",
        filename="a.pdf",
        content_type="application/pdf",
        size_bytes=1000,
        sha256="x",
        module="documents",
        scan_status=ScanStatus.SKIPPED,
    )

    storage = BackupService().summary(user=user)["storage"]

    assert storage["total_bytes"] == 1000
    assert storage["file_count"] == 1


def test_failures_are_listed(make_user, tenant):
    user = make_user(tenant=tenant)
    BackupService().record(
        kind=BackupKind.DOCUMENTS,
        status=BackupStatus.FAILED,
        started_at=timezone.now(),
        message="R2 credentials rejected",
    )

    summary = BackupService().summary(user=user)

    assert summary["recent_failures"][0]["message"] == "R2 credentials rejected"


def test_endpoint_returns_summary(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)

    response = auth_client(user).get("/api/v1/backups/")

    assert response.status_code == 200
    body = response.json()["data"]
    assert "areas" in body and "storage" in body

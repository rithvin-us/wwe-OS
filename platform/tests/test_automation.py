"""Automation engine tests — registry, rule validation, execution, and the
rule/history API."""

from __future__ import annotations

import zipfile
from datetime import datetime, timedelta
from io import BytesIO

import pytest
from assets.backend.models import Asset
from automation import registry
from automation.models import (
    AutomationRule,
    AutomationRun,
    Cadence,
    Destination,
    RunStatus,
    TriggerType,
)
from automation.services import AutomationService, _advance
from django.utils import timezone
from shared.exceptions import ConflictError, ValidationError
from storage.services import StorageService
from tagging.services import TagService

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


@pytest.fixture
def tag(tenant):
    return TagService().create_tag(tenant=tenant, name="For Auditor")


@pytest.fixture
def tagged_asset(tenant, tag):
    stored = StorageService().store(
        data=b"warranty pdf bytes",
        filename="warranty.pdf",
        content_type="application/pdf",
        module="assets",
        category="asset-file",
        tenant=tenant,
    )
    asset = Asset.objects.create(
        tenant=tenant, name="Laptop", asset_tag="AST-1", file=stored
    )
    TagService().set_tags_for_object(
        tenant=tenant,
        module="assets",
        object_type="Asset",
        object_id=str(asset.id),
        tag_ids=[str(tag.id)],
    )
    return asset


def _make_rule(tenant, **overrides) -> AutomationRule:
    defaults = dict(
        tenant=tenant,
        name="Auditor bundle",
        source_modules=["assets"],
        required_tags=[],
        destination=Destination.DOWNLOADED_PACKAGE,
        cadence=Cadence.ONCE,
        next_run_at=timezone.now(),
    )
    defaults.update(overrides)
    return AutomationRule.objects.create(**defaults)


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #


def test_modules_register_their_sources():
    modules = {a.module for a in registry.all_sources()}
    assert {"assets", "contracts", "documents", "purchase"} <= modules
    assert "inventory" not in modules  # no natural file — registers nothing


def test_get_unregistered_source_raises():
    from shared.exceptions import NotFoundError

    with pytest.raises(NotFoundError):
        registry.get_source("nope")


# --------------------------------------------------------------------------- #
# Cadence advance
# --------------------------------------------------------------------------- #


def test_advance_daily_weekly_once():
    now = datetime(2026, 1, 15, 6, 0)
    assert _advance(Cadence.DAILY, now) == now + timedelta(days=1)
    assert _advance(Cadence.WEEKLY, now) == now + timedelta(weeks=1)
    assert _advance(Cadence.ONCE, now) is None


def test_advance_monthly_clamps_short_month():
    jan_31 = datetime(2026, 1, 31, 6, 0)
    assert _advance(Cadence.MONTHLY, jan_31) == datetime(2026, 2, 28, 6, 0)


# --------------------------------------------------------------------------- #
# Rule validation
# --------------------------------------------------------------------------- #


def test_validate_rule_rejects_empty_tags():
    with pytest.raises(ValidationError):
        AutomationService().validate_rule(
            data={
                "required_tags": [],
                "destination": Destination.DOWNLOADED_PACKAGE,
                "source_modules": ["assets"],
            }
        )


def test_validate_rule_requires_report_key_for_report_destination():
    with pytest.raises(ValidationError):
        AutomationService().validate_rule(
            data={
                "required_tags": ["x"],
                "destination": Destination.GENERATE_REPORT,
                "report_key": "",
            }
        )


def test_validate_rule_requires_source_modules_for_file_destination():
    with pytest.raises(ValidationError):
        AutomationService().validate_rule(
            data={
                "required_tags": ["x"],
                "destination": Destination.AUDITOR_FOLDER,
                "source_modules": [],
            }
        )


# --------------------------------------------------------------------------- #
# Execution
# --------------------------------------------------------------------------- #


def test_run_rule_packages_tagged_files(tenant, tag, tagged_asset):
    rule = _make_rule(tenant, required_tags=[str(tag.id)])

    run = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert run.status == RunStatus.SUCCESS, run.error_message
    assert run.item_count == 1
    assert run.items[0]["included"] is True
    assert run.output_file is not None
    archive = zipfile.ZipFile(BytesIO(StorageService().open(run.output_file)))
    assert any(name.endswith("warranty.pdf") for name in archive.namelist())


def test_run_rule_with_no_matches_fails_cleanly(tenant, tag):
    rule = _make_rule(tenant, required_tags=[str(tag.id)])  # no asset tagged with it

    run = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert run.status == RunStatus.FAILED
    assert "No files matched" in run.error_message
    assert run.output_file is None


def test_run_rule_advances_once_cadence_to_inactive(tenant, tag, tagged_asset):
    rule = _make_rule(tenant, required_tags=[str(tag.id)], cadence=Cadence.ONCE)

    AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)
    rule.refresh_from_db()

    assert rule.is_active is False
    assert rule.next_run_at is None
    assert rule.last_run_at is not None


def test_run_rule_rejects_stub_destination(tenant):
    rule = _make_rule(tenant, destination=Destination.EMAIL, required_tags=["x"])

    with pytest.raises(ConflictError):
        AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert AutomationRun.objects.filter(rule=rule).count() == 0


def test_run_rule_generate_report_destination(tenant, tag, tagged_asset):
    rule = _make_rule(
        tenant,
        destination=Destination.GENERATE_REPORT,
        report_key="asset-register",
        required_tags=[str(tag.id)],
        source_modules=[],
    )

    run = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert run.status == RunStatus.SUCCESS
    assert run.report_export is not None


def test_run_rule_writes_audit_entry(tenant, tag, tagged_asset):
    from audit.models import AuditLog

    rule = _make_rule(tenant, required_tags=[str(tag.id)])
    AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert AuditLog.objects.filter(
        action="automation.rule_executed", module="automation", object_id=str(rule.id)
    ).exists()


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #

RULES_URL = "/api/v1/automation/rules/"


def test_api_create_rule_rejects_empty_tags(tenant, owner, auth_client):
    response = auth_client(owner).post(
        RULES_URL,
        {
            "name": "Bad rule",
            "destination": Destination.DOWNLOADED_PACKAGE,
            "source_modules": ["assets"],
            "required_tags": [],
            "next_run_at": timezone.now().isoformat(),
        },
        format="json",
    )
    assert response.status_code == 422


def test_api_create_and_run_now(tenant, owner, tag, tagged_asset, auth_client):
    client = auth_client(owner)
    create = client.post(
        RULES_URL,
        {
            "name": "Auditor pack",
            "destination": Destination.DOWNLOADED_PACKAGE,
            "source_modules": ["assets"],
            "required_tags": [str(tag.id)],
            "next_run_at": timezone.now().isoformat(),
        },
        format="json",
    )
    assert create.status_code == 201
    rule_id = create.data["id"]

    run = client.post(f"{RULES_URL}{rule_id}/run-now/")
    assert run.status_code == 200
    assert run.data["status"] == "success"


def test_api_run_now_requires_automation_run_permission(
    tenant, make_user, make_role, grant, auth_client
):
    user = make_user(email="viewer@acme.test", username="viewer", tenant=tenant)
    grant(user, make_role(tenant, "viewer", ["automation.view", "automation.manage"]))
    rule = _make_rule(tenant, required_tags=["x"])

    response = auth_client(user).post(f"{RULES_URL}{rule.id}/run-now/")
    assert response.status_code == 403

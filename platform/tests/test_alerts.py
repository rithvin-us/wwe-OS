"""Alert rule engine tests — validation, threshold edge-triggering, schedule
timing, metric resolution against real module data, and the rule API."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from alerts.metrics import contracts_stats, purchase_stats
from alerts.models import AlertRule, ConditionType, Metric, Operator
from alerts.services import AlertService
from contracts.backend.models import Contract, ContractStatus
from django.utils import timezone
from notifications.models import Channel, Notification
from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill
from shared.exceptions import ValidationError

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def make_bill(tenant, **overrides):
    defaults = {
        "tenant": tenant,
        "seller_name": "Acme Supplies",
        "purchase_date": date.today(),
        "total_rate": Decimal("100.00"),
        "document_url": "https://example.test/bill.pdf",
        "status": BillStatus.NEEDS_ATTENTION,
        "payment_status": PaymentStatus.UNPAID,
    }
    defaults.update(overrides)
    return PurchaseBill.objects.create(**defaults)


def make_contract(tenant, **overrides):
    defaults = {
        "tenant": tenant,
        "title": "Office lease",
        "counterparty": "Acme Realty",
        "status": ContractStatus.ACTIVE,
        "end_date": date.today() + timedelta(days=10),
    }
    defaults.update(overrides)
    return Contract.objects.create(**defaults)


# --------------------------------------------------------------------------- #
# Metric resolution — the in-process API self-call actually returns real data
# --------------------------------------------------------------------------- #


def test_purchase_stats_reads_real_bills(tenant, owner):
    make_bill(tenant, status=BillStatus.NEEDS_ATTENTION, payment_status=PaymentStatus.UNPAID)
    make_bill(tenant, status=BillStatus.PROCESSED, payment_status=PaymentStatus.PAID)

    stats = purchase_stats(tenant)

    assert stats["needs_attention"] == 1
    assert stats["unpaid"] == 1
    assert stats["total"] == 2


def test_contracts_stats_reads_real_contracts(tenant, owner):
    make_contract(tenant, end_date=date.today() + timedelta(days=5))
    make_contract(tenant, status=ContractStatus.DRAFT, end_date=None)

    stats = contracts_stats(tenant)

    assert stats["expiring_soon"] == 1
    assert stats["active"] == 1


def test_metric_resolution_returns_none_without_an_owner(tenant):
    assert purchase_stats(tenant) is None


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


def test_threshold_rule_requires_operator_and_value():
    service = AlertService()
    with pytest.raises(ValidationError):
        service.validate_rule(
            data={
                "condition_type": ConditionType.THRESHOLD,
                "metric": Metric.PURCHASE_UNPAID_COUNT,
            }
        )


def test_threshold_rule_rejects_digest_metric():
    service = AlertService()
    with pytest.raises(ValidationError):
        service.validate_rule(
            data={
                "condition_type": ConditionType.THRESHOLD,
                "metric": Metric.OPERATIONAL_DIGEST,
                "operator": Operator.GT,
                "threshold_value": Decimal("10"),
            }
        )


def test_schedule_rule_requires_time():
    service = AlertService()
    with pytest.raises(ValidationError):
        service.validate_rule(
            data={"condition_type": ConditionType.SCHEDULE, "metric": Metric.OPERATIONAL_DIGEST}
        )


def test_valid_threshold_rule_passes():
    AlertService().validate_rule(
        data={
            "condition_type": ConditionType.THRESHOLD,
            "metric": Metric.PURCHASE_UNPAID_COUNT,
            "operator": Operator.GT,
            "threshold_value": Decimal("5"),
        }
    )


def test_valid_schedule_rule_passes():
    AlertService().validate_rule(
        data={
            "condition_type": ConditionType.SCHEDULE,
            "metric": Metric.OPERATIONAL_DIGEST,
            "schedule_time": time(9, 0),
        }
    )


# --------------------------------------------------------------------------- #
# Threshold evaluation — edge-triggering
# --------------------------------------------------------------------------- #


def test_threshold_fires_once_then_stays_quiet_while_still_breached(tenant, owner):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("0"),
    )
    make_bill(tenant, payment_status=PaymentStatus.UNPAID)

    first = AlertService().check_rule(rule=rule)
    rule.refresh_from_db()
    second = AlertService().check_rule(rule=rule)

    assert first is True
    assert second is False  # still breached, but already notified once
    assert rule.was_firing is True
    assert Notification.objects.filter(recipient=owner, channel=Channel.TELEGRAM).count() == 1


def test_threshold_refires_after_dropping_and_breaching_again(tenant, owner):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("0"),
    )
    bill = make_bill(tenant, payment_status=PaymentStatus.UNPAID)

    assert AlertService().check_rule(rule=rule) is True
    rule.refresh_from_db()

    bill.payment_status = PaymentStatus.PAID
    bill.save(update_fields=["payment_status"])
    assert AlertService().check_rule(rule=rule) is False  # dropped below threshold
    rule.refresh_from_db()
    assert rule.was_firing is False

    bill.payment_status = PaymentStatus.UNPAID
    bill.save(update_fields=["payment_status"])
    assert AlertService().check_rule(rule=rule) is True  # breached again
    assert Notification.objects.filter(recipient=owner, channel=Channel.TELEGRAM).count() == 2


def test_threshold_below_value_never_fires(tenant, owner):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("5"),
    )
    make_bill(tenant, payment_status=PaymentStatus.UNPAID)

    assert AlertService().check_rule(rule=rule) is False
    assert Notification.objects.count() == 0


# --------------------------------------------------------------------------- #
# Schedule evaluation — daily digest
# --------------------------------------------------------------------------- #


def test_digest_rule_sends_and_records_trigger(tenant, owner):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Morning digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(9, 0),
    )

    fired = AlertService().check_rule(rule=rule)

    assert fired is True
    rule.refresh_from_db()
    assert rule.last_triggered_at is not None
    note = Notification.objects.get(recipient=owner)
    assert note.channel == Channel.TELEGRAM
    assert "Unpaid purchase bills" in note.body


def test_schedule_not_due_before_its_time(tenant):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Morning digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(9, 0),
    )
    morning_before = timezone.make_aware(datetime.combine(date.today(), time(8, 0)))

    assert AlertService().is_due(rule, now=morning_before) is False


def test_schedule_due_after_its_time_and_not_yet_sent_today(tenant):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Morning digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(9, 0),
    )
    after = timezone.make_aware(datetime.combine(date.today(), time(9, 30)))

    assert AlertService().is_due(rule, now=after) is True


def test_schedule_not_due_again_same_day_after_sending(tenant, owner):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Morning digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(9, 0),
    )
    AlertService().check_rule(rule=rule)
    rule.refresh_from_db()
    later_same_day = timezone.make_aware(datetime.combine(date.today(), time(18, 0)))

    assert AlertService().is_due(rule, now=later_same_day) is False


def test_inactive_rule_is_never_due(tenant):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Morning digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(0, 0),
        is_active=False,
    )
    assert AlertService().is_due(rule, now=timezone.now()) is False


def test_run_due_sweeps_every_active_rule_for_a_tenant(tenant, owner):
    AlertRule.objects.create(
        tenant=tenant,
        name="Always due digest",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(0, 0),
    )
    AlertRule.objects.create(
        tenant=tenant,
        name="Inactive",
        condition_type=ConditionType.SCHEDULE,
        metric=Metric.OPERATIONAL_DIGEST,
        schedule_time=time(0, 0),
        is_active=False,
    )

    fired = AlertService().run_due(tenant=tenant)

    assert fired == 1


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_create_threshold_rule(tenant, owner, auth_client):
    payload = {
        "name": "Too many unpaid bills",
        "condition_type": "threshold",
        "metric": "purchase_unpaid_count",
        "operator": "gt",
        "threshold_value": "3",
    }
    response = auth_client(owner).post("/api/v1/alerts/rules/", payload, format="json")
    assert response.status_code == 201
    assert response.data["metric"] == "purchase_unpaid_count"


def test_api_rejects_invalid_threshold_rule(tenant, owner, auth_client):
    payload = {
        "name": "Bad rule",
        "condition_type": "threshold",
        "metric": "purchase_unpaid_count",
    }
    response = auth_client(owner).post("/api/v1/alerts/rules/", payload, format="json")
    assert response.status_code == 422


def test_api_partial_update_keeps_rule_valid(tenant, owner, auth_client):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("3"),
    )
    client = auth_client(owner)

    response = client.patch(
        f"/api/v1/alerts/rules/{rule.id}/", {"threshold_value": "10"}, format="json"
    )
    assert response.status_code == 200
    assert Decimal(response.data["threshold_value"]) == Decimal("10")


def test_api_check_now_evaluates_immediately(tenant, owner, auth_client):
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("0"),
    )
    make_bill(tenant, payment_status=PaymentStatus.UNPAID)

    response = auth_client(owner).post(f"/api/v1/alerts/rules/{rule.id}/check-now/")

    assert response.status_code == 200
    assert response.data["fired"] is True


def test_api_requires_permission(tenant, make_user, member_role, grant, auth_client):
    user = make_user(email="member@acme.test", username="member", tenant=tenant)
    grant(user, member_role)

    response = auth_client(user).get("/api/v1/alerts/rules/")
    assert response.status_code == 403


# --------------------------------------------------------------------------- #
# Notification dispatch — Telegram send is invoked, not just queued
# --------------------------------------------------------------------------- #


def test_check_rule_triggers_telegram_send(tenant, owner, settings):
    settings.TELEGRAM_BOT_TOKEN = "test-token"
    settings.TELEGRAM_ALERT_CHAT_ID = "12345"
    rule = AlertRule.objects.create(
        tenant=tenant,
        name="Too many unpaid bills",
        condition_type=ConditionType.THRESHOLD,
        metric=Metric.PURCHASE_UNPAID_COUNT,
        operator=Operator.GT,
        threshold_value=Decimal("0"),
    )
    make_bill(tenant, payment_status=PaymentStatus.UNPAID)

    with patch("notifications.services.httpx.post") as mock_post:
        mock_post.return_value.raise_for_status.return_value = None
        AlertService().check_rule(rule=rule)

    mock_post.assert_called_once()

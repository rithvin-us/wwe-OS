"""The Workspace cockpit answers "what needs me, and what changed?" from real
data — a single ranked worklist (approvals + deadlines) with headline counts,
plus a 'what changed' digest from the audit trail. Everything is tenant-scoped.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from audit.services import AuditService
from briefing.services import BriefingService
from django.utils import timezone

pytestmark = pytest.mark.django_db


def _record(tenant, action, module, object_id="1"):
    AuditService().record(
        action=action,
        module=module,
        object_type="Thing",
        object_id=object_id,
        changes={"number": object_id},
        tenant=tenant,
    )


# --------------------------------------------------------------------------- #
# Digest (the "what changed" section)
# --------------------------------------------------------------------------- #


def test_activity_counts_group_by_action(make_user, tenant):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")
    _record(tenant, "finance.invoice_generated", "finance", "2")
    _record(tenant, "documents.uploaded", "documents", "3")

    digest = BriefingService().summary(user=user, days=7)["digest"]

    counts = {(a["module"], a["action"]): a["count"] for a in digest["activity"]}
    assert counts[("finance", "finance.invoice_generated")] == 2
    assert counts[("documents", "documents.uploaded")] == 1


def test_highlights_are_most_recent_first(make_user, tenant):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")
    _record(tenant, "documents.uploaded", "documents", "2")

    digest = BriefingService().summary(user=user, days=7)["digest"]

    assert digest["highlights"][0]["object_id"] == "2"


def test_activity_is_tenant_scoped(make_user, tenant, other_tenant):
    user = make_user(tenant=tenant)
    _record(other_tenant, "finance.invoice_generated", "finance", "1")

    digest = BriefingService().summary(user=user, days=7)["digest"]

    assert digest["activity"] == []


# --------------------------------------------------------------------------- #
# Worklist (the ranked "what needs me" list)
# --------------------------------------------------------------------------- #


def _approval(object_id, *, days_ago=0, priority="normal"):
    return {
        "kind": "leave",
        "label": "Leave",
        "object_id": object_id,
        "title": f"Leave {object_id}",
        "requester": "Asha",
        "submitted_at": timezone.now() - timedelta(days=days_ago),
        "priority": priority,
        "current_step": "Owner",
        "url": f"/hr/leave/{object_id}",
        "extra": {},
    }


def _deadline(object_id, *, days_remaining):
    return {
        "kind": "invoice_due",
        "label": f"Invoice {object_id}",
        "due_date": "2026-09-01",
        "days_remaining": days_remaining,
        "is_overdue": days_remaining < 0,
        "url": f"/invoices/{object_id}",
        "object_id": object_id,
        "extra": {},
    }


@pytest.fixture
def _sources(monkeypatch):
    """Stub the two aggregators so a test controls exactly what is pending."""

    def install(approvals, deadlines):
        from approvals.services import ApprovalService
        from deadlines.services import DeadlineService

        monkeypatch.setattr(ApprovalService, "pending", lambda self, *, user: list(approvals))
        monkeypatch.setattr(
            DeadlineService, "upcoming", lambda self, *, user, within_days: list(deadlines)
        )

    return install


def test_worklist_ranks_overdue_then_approvals_then_today_then_soon(make_user, tenant, _sources):
    user = make_user(tenant=tenant)
    _sources(
        approvals=[_approval("a1", days_ago=3)],
        deadlines=[
            _deadline("soon", days_remaining=10),
            _deadline("overdue", days_remaining=-5),
            _deadline("today", days_remaining=0),
        ],
    )

    worklist = BriefingService().summary(user=user, days=7)["worklist"]

    assert [i["urgency"] for i in worklist] == ["overdue", "waiting", "today", "soon"]
    assert worklist[1]["actionable"] is True  # the approval can be decided in place
    assert worklist[0]["actionable"] is False  # a deadline just links to its record
    assert "_score" not in worklist[0]  # internal ranking key never leaks


def test_higher_priority_approval_outranks_a_lower_one(make_user, tenant, _sources):
    user = make_user(tenant=tenant)
    _sources(
        approvals=[
            _approval("normal", days_ago=1),
            _approval("urgent", days_ago=1, priority="urgent"),
        ],
        deadlines=[],
    )

    worklist = BriefingService().summary(user=user, days=7)["worklist"]

    assert [i["object_id"] for i in worklist] == ["urgent", "normal"]


def test_counts_are_derived_from_the_worklist(make_user, tenant, _sources):
    user = make_user(tenant=tenant)
    _sources(
        approvals=[_approval("a1"), _approval("a2")],
        deadlines=[_deadline("overdue", days_remaining=-1), _deadline("soon", days_remaining=5)],
    )

    summary = BriefingService().summary(user=user, days=7)

    assert summary["counts"] == {"waiting": 2, "overdue": 1, "due_soon": 1}


def test_endpoint_returns_the_cockpit(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")

    response = auth_client(user).get("/api/v1/briefing/?days=7")

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["window_days"] == 7
    assert set(body["counts"]) == {"waiting", "overdue", "due_soon"}
    assert isinstance(body["worklist"], list)
    assert "activity" in body["digest"]

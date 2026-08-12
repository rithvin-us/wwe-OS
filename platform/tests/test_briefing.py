"""The Management Briefing answers 'what changed?' from real data — activity
counts and highlights from the audit trail, plus an attention summary from the
approval and deadline aggregators. Everything is tenant-scoped.
"""

from __future__ import annotations

import pytest
from audit.services import AuditService
from briefing.services import BriefingService

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


def test_activity_counts_group_by_action(make_user, tenant):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")
    _record(tenant, "finance.invoice_generated", "finance", "2")
    _record(tenant, "documents.uploaded", "documents", "3")

    summary = BriefingService().summary(user=user, days=7)

    counts = {(a["module"], a["action"]): a["count"] for a in summary["activity"]}
    assert counts[("finance", "finance.invoice_generated")] == 2
    assert counts[("documents", "documents.uploaded")] == 1


def test_highlights_are_most_recent_first(make_user, tenant):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")
    _record(tenant, "documents.uploaded", "documents", "2")

    summary = BriefingService().summary(user=user, days=7)

    assert summary["highlights"][0]["object_id"] == "2"


def test_attention_block_is_present(make_user, tenant):
    user = make_user(tenant=tenant)

    summary = BriefingService().summary(user=user, days=7)

    assert set(summary["attention"]) == {"pending_approvals", "overdue", "due_soon"}


def test_activity_is_tenant_scoped(make_user, tenant, other_tenant):
    user = make_user(tenant=tenant)
    _record(other_tenant, "finance.invoice_generated", "finance", "1")

    summary = BriefingService().summary(user=user, days=7)

    assert summary["activity"] == []


def test_endpoint_returns_the_summary(make_user, tenant, auth_client):
    user = make_user(tenant=tenant)
    _record(tenant, "finance.invoice_generated", "finance", "1")

    response = auth_client(user).get("/api/v1/briefing/?days=7")

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["window_days"] == 7
    assert "attention" in body

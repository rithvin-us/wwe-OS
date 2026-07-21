"""Contracts module tests — platform-integration surface end to end."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from audit.models import AuditLog
from contracts.backend.models import ContractStatus, SummaryStatus
from contracts.backend.services.contract import ContractService
from django.core.files.uploadedfile import SimpleUploadedFile
from notifications.models import Notification
from search.services import SearchService
from storage.models import StoredFile
from workflow.models import InstanceStatus

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/contracts/contracts/"


def _create(tenant, owner, **overrides):
    data = {
        "title": "Cloud hosting agreement",
        "counterparty": "Vendor Inc",
        "category": "service",
        "value": None,
        "currency": "USD",
        "start_date": None,
        "end_date": None,
        "auto_renew": False,
        "renewal_notice_days": 30,
        "notes": "Annual cloud hosting.",
    }
    data.update(overrides)
    return ContractService().create(tenant=tenant, owner=owner, data=data)


# --------------------------------------------------------------------------- #
# Create + search + audit
# --------------------------------------------------------------------------- #


def test_create_indexes_and_audits(tenant, owner):
    contract = _create(tenant, owner)
    assert contract.status == ContractStatus.DRAFT
    assert AuditLog.objects.filter(action="contracts.created", module="contracts").exists()
    assert any(
        r["doc_id"] == str(contract.id)
        for r in SearchService().search(user=owner, query="hosting")["results"]
    )


def test_api_create_validates_date_order(tenant, owner, auth_client):
    response = auth_client(owner).post(
        LIST_URL,
        {
            "title": "Bad dates",
            "counterparty": "X",
            "category": "other",
            "start_date": "2026-12-01",
            "end_date": "2026-01-01",
        },
        format="json",
    )
    assert response.status_code == 422


# --------------------------------------------------------------------------- #
# Storage: attach signed file + AI summary
# --------------------------------------------------------------------------- #


def test_attach_file_stores_via_platform(tenant, owner):
    contract = _create(tenant, owner)
    contract = ContractService().attach_file(
        contract=contract,
        data=b"Signed agreement text, effective 2026.",
        filename="signed.txt",
        content_type="text/plain",
        actor=owner,
    )
    assert isinstance(contract.file, StoredFile)
    assert contract.file.module == "contracts"

    contract = ContractService().generate_summary(contract)
    assert contract.summary_status == SummaryStatus.READY
    assert contract.ai_summary.startswith("[mock:")


def test_attach_replaces_previous_file(tenant, owner):
    contract = _create(tenant, owner)
    ContractService().attach_file(
        contract=contract, data=b"v1", filename="a.txt", content_type="text/plain", actor=owner
    )
    first_file_id = contract.file_id
    ContractService().attach_file(
        contract=contract, data=b"v2", filename="b.txt", content_type="text/plain", actor=owner
    )
    assert contract.file_id != first_file_id
    assert StoredFile.objects.filter(id=first_file_id).count() == 0  # old one soft-deleted


# --------------------------------------------------------------------------- #
# Approval via the platform workflow engine
# --------------------------------------------------------------------------- #


def test_submit_and_approve_activates_contract(tenant, owner, auth_client):
    contract = _create(tenant, owner)
    contract = ContractService().submit_for_approval(contract=contract, actor=owner)
    assert contract.status == ContractStatus.IN_REVIEW
    assert contract.approval.status == InstanceStatus.RUNNING
    assert Notification.objects.filter(recipient=owner, category="workflow").exists()

    response = auth_client(owner).post(
        f"/api/v1/workflow/instances/{contract.approval_id}/approve/", {}
    )
    assert response.status_code == 200
    contract.refresh_from_db()
    assert contract.status == ContractStatus.ACTIVE
    assert Notification.objects.filter(recipient=owner, title="Contract approved").exists()


def test_reject_returns_contract_to_draft(tenant, owner, auth_client):
    contract = _create(tenant, owner)
    contract = ContractService().submit_for_approval(contract=contract, actor=owner)
    auth_client(owner).post(
        f"/api/v1/workflow/instances/{contract.approval_id}/reject/", {"reason": "wrong party"}
    )
    contract.refresh_from_db()
    assert contract.status == ContractStatus.DRAFT


# --------------------------------------------------------------------------- #
# Termination + expiry scan (notifications)
# --------------------------------------------------------------------------- #


def test_terminate_requires_reason_and_finishes(tenant, owner):
    from shared.exceptions import ValidationError

    contract = _create(tenant, owner)
    ContractService().mark_active(contract)
    with pytest.raises(ValidationError):
        ContractService().terminate(contract=contract, actor=owner, reason="  ")
    contract = ContractService().terminate(contract=contract, actor=owner, reason="breach")
    assert contract.status == ContractStatus.TERMINATED
    assert AuditLog.objects.filter(action="contracts.terminated").exists()


def test_expiry_scan_expires_and_reminds(tenant, owner):
    today = date.today()
    past = _create(tenant, owner, title="Old lease", end_date=today - timedelta(days=1))
    ContractService().mark_active(past)
    soon = _create(
        tenant,
        owner,
        title="Renewing soon",
        end_date=today + timedelta(days=10),
        renewal_notice_days=30,
    )
    ContractService().mark_active(soon)

    result = ContractService().run_expiry_scan(tenant=tenant)
    assert result == {"expired": 1, "reminded": 1}

    past.refresh_from_db()
    assert past.status == ContractStatus.EXPIRED
    assert Notification.objects.filter(recipient=owner, title="Contract expired").exists()
    assert Notification.objects.filter(recipient=owner, title="Contract renewal due soon").exists()


# --------------------------------------------------------------------------- #
# API surface
# --------------------------------------------------------------------------- #


def test_api_stats_and_expiring(tenant, owner, auth_client):
    active = _create(tenant, owner, end_date=date.today() + timedelta(days=5), value="1200.00")
    ContractService().mark_active(active)
    _create(tenant, owner, title="A draft")

    client = auth_client(owner)
    stats = client.get(f"{LIST_URL}stats/")
    assert stats.data["active"] == 1
    assert stats.data["draft"] == 1
    assert stats.data["expiring_soon"] == 1
    assert stats.data["active_value"] == "1200.00"

    expiring = client.get(f"{LIST_URL}expiring/")
    assert len(expiring.data) == 1


def test_api_attach_download_export(tenant, owner, auth_client):
    contract = _create(tenant, owner)
    client = auth_client(owner)

    attached = client.post(
        f"{LIST_URL}{contract.id}/attach/",
        {"file": SimpleUploadedFile("c.txt", b"contract text", content_type="text/plain")},
        format="multipart",
    )
    assert attached.status_code == 200
    assert attached.data["file_name"] == "c.txt"

    download = client.get(f"{LIST_URL}{contract.id}/download/")
    assert download.status_code == 200
    assert download.content == b"contract text"

    export = client.post(f"{LIST_URL}export/", {"format": "csv"}, format="json")
    assert export.status_code == 200
    assert b"Cloud hosting agreement" in export.content


def test_api_permissions_and_isolation(tenant, other_tenant, owner, make_user, auth_client):
    _create(tenant, owner)

    nobody = make_user("nobody@acme.test", "nobody", tenant=tenant)
    assert auth_client(nobody).get(LIST_URL).status_code == 403

    from roles.models import Role
    from roles.services import RoleService

    outsider = make_user("owner@globex.test", "globex", tenant=other_tenant)
    RoleService().assign_role(user=outsider, role=Role.objects.get(slug="owner"))
    assert auth_client(outsider).get(LIST_URL).data["data"] == []

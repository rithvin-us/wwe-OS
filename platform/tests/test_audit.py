from __future__ import annotations

import pytest
from audit.models import AuditLog

from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_registration_generates_audit_record(api):
    api.post(
        "/api/v1/auth/register/",
        {"email": "audit@acme.test", "username": "audited", "password": PASSWORD},
        format="json",
    )
    assert AuditLog.objects.filter(action="user.created").exists()


def test_login_generates_audit_record(api, make_user):
    make_user(email="a@acme.test", username="a")
    api.post("/api/v1/auth/login/", {"email": "a@acme.test", "password": PASSWORD}, format="json")
    assert AuditLog.objects.filter(action="user.logged_in").exists()


def test_audit_records_are_immutable(db):
    entry = AuditLog.objects.create(action="user.created", module="users")

    with pytest.raises(ValueError):
        entry.action = "tampered"
        entry.save(update_fields=["action"])

    with pytest.raises(ValueError):
        entry.delete()


def test_audit_records_can_be_archived(db):
    entry = AuditLog.objects.create(action="user.created", module="users")
    entry.archive()
    entry.refresh_from_db()
    assert entry.archived is True

from __future__ import annotations

import pytest
from auth.models import EmailVerificationToken, LoginAttempt, PasswordResetToken
from django.core import mail
from users.models import User

from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db

REGISTER = "/api/v1/auth/register/"
LOGIN = "/api/v1/auth/login/"
REFRESH = "/api/v1/auth/refresh/"


def test_register_creates_user_and_sends_verification(api):
    resp = api.post(
        REGISTER,
        {"email": "new@acme.test", "username": "newbie", "password": PASSWORD},
        format="json",
    )
    assert resp.status_code == 201
    user = User.objects.get(email="new@acme.test")
    assert not user.is_email_verified
    assert EmailVerificationToken.objects.filter(user=user).exists()
    assert len(mail.outbox) == 1


def test_register_rejects_oversized_password(api):
    """A multi-megabyte password is rejected by schema validation (422)
    before it ever reaches the CPU-heavy Argon2 hasher."""
    resp = api.post(
        REGISTER,
        {"email": "dos@acme.test", "username": "dos", "password": "A1!" + "x" * 5000},
        format="json",
    )
    assert resp.status_code == 422
    assert not User.objects.filter(email="dos@acme.test").exists()


def test_first_registration_bootstraps_company_and_becomes_owner(api):
    from tenancy.models import Tenant

    assert Tenant.objects.count() == 0

    resp = api.post(
        REGISTER,
        {
            "email": "founder@acme.test",
            "username": "founder",
            "password": PASSWORD,
            "company_name": "Acme Trading Co",
        },
        format="json",
    )
    assert resp.status_code == 201

    tenant = Tenant.objects.get()
    assert tenant.name == "Acme Trading Co"
    user = User.objects.get(email="founder@acme.test")
    assert user.tenant_id == tenant.id
    assert user.has_platform_permission("settings.manage")  # owner-only permission


def test_second_registration_joins_existing_company_as_member(api):
    from tenancy.models import Tenant

    api.post(
        REGISTER,
        {"email": "founder@acme.test", "username": "founder", "password": PASSWORD},
        format="json",
    )
    assert Tenant.objects.count() == 1
    first_tenant_id = Tenant.objects.get().id

    api.post(
        REGISTER,
        {"email": "second@acme.test", "username": "second", "password": PASSWORD},
        format="json",
    )

    # No second tenant was created — both users share the one company.
    assert Tenant.objects.count() == 1
    second_user = User.objects.get(email="second@acme.test")
    assert second_user.tenant_id == first_tenant_id
    assert second_user.has_platform_permission("dashboard.view")
    assert not second_user.has_platform_permission("settings.manage")  # member, not owner


def test_registration_without_company_name_gets_a_default(api):
    from tenancy.models import Tenant

    api.post(
        REGISTER,
        {"email": "founder@acme.test", "username": "founder", "password": PASSWORD},
        format="json",
    )
    assert Tenant.objects.get().name == "My Company"


def test_login_returns_token_pair(api, make_user):
    make_user(email="a@acme.test", username="a")
    resp = api.post(LOGIN, {"email": "a@acme.test", "password": PASSWORD}, format="json")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "access" in body
    assert "refresh" in body


def test_login_wrong_password_is_rejected_and_recorded(api, make_user):
    make_user(email="a@acme.test", username="a")
    resp = api.post(LOGIN, {"email": "a@acme.test", "password": "wrong-password"}, format="json")
    assert resp.status_code == 401
    assert LoginAttempt.objects.filter(email="a@acme.test", successful=False).exists()


def test_account_locks_after_repeated_failures(api, make_user):
    make_user(email="a@acme.test", username="a")
    for _ in range(5):
        api.post(LOGIN, {"email": "a@acme.test", "password": "wrong-password"}, format="json")
    # Even the correct password is now refused while locked.
    resp = api.post(LOGIN, {"email": "a@acme.test", "password": PASSWORD}, format="json")
    assert resp.status_code == 429


def test_lockout_backoff_escalates_exponentially(settings):
    """The lock window doubles with each failure past the threshold and is
    capped — an escalating backoff, never a fixed hard lock."""
    from auth.services import AuthService

    settings.AUTH_LOCKOUT_MAX_ATTEMPTS = 5
    settings.AUTH_LOCKOUT_BASE_BACKOFF_SECONDS = 60
    settings.AUTH_LOCKOUT_BACKOFF_FACTOR = 2.0
    settings.AUTH_LOCKOUT_MAX_BACKOFF_SECONDS = 1000

    svc = AuthService()
    assert svc._backoff_seconds(5) == 60  # threshold crossed → base
    assert svc._backoff_seconds(6) == 120  # +1 failure → doubled
    assert svc._backoff_seconds(7) == 240
    assert svc._backoff_seconds(20) == 1000  # capped, never unbounded


def test_refresh_rotates_access(api, make_user):
    make_user(email="a@acme.test", username="a")
    login = api.post(LOGIN, {"email": "a@acme.test", "password": PASSWORD}, format="json")
    refresh = login.json()["data"]["refresh"]
    resp = api.post(REFRESH, {"refresh": refresh}, format="json")
    assert resp.status_code == 200
    assert "access" in resp.json()["data"]


def test_logout_blacklists_refresh(api, make_user, auth_client):
    user = make_user(email="a@acme.test", username="a")
    login = api.post(LOGIN, {"email": "a@acme.test", "password": PASSWORD}, format="json")
    refresh = login.json()["data"]["refresh"]
    client = auth_client(user)
    assert (
        client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json").status_code == 200
    )
    # A blacklisted refresh can no longer mint access tokens.
    assert api.post(REFRESH, {"refresh": refresh}, format="json").status_code == 401


def test_password_reset_flow(api, make_user):
    user = make_user(email="a@acme.test", username="a")
    api.post("/api/v1/auth/password/reset/", {"email": "a@acme.test"}, format="json")
    token_row = PasswordResetToken.objects.filter(user=user).first()
    assert token_row is not None
    # The raw token was emailed; recover it from the outbox for the test.
    raw = mail.outbox[-1].body.split(":")[-1].strip()
    resp = api.post(
        "/api/v1/auth/password/reset/confirm/",
        {"token": raw, "new_password": "N3w!Passw0rd"},
        format="json",
    )
    assert resp.status_code == 200
    assert (
        api.post(
            LOGIN, {"email": "a@acme.test", "password": "N3w!Passw0rd"}, format="json"
        ).status_code
        == 200
    )


def test_email_verification(api):
    api.post(
        REGISTER,
        {"email": "v@acme.test", "username": "verify", "password": PASSWORD},
        format="json",
    )
    raw = mail.outbox[-1].body.split(":")[-1].strip()
    resp = api.post("/api/v1/auth/email/verify/", {"token": raw}, format="json")
    assert resp.status_code == 200
    assert User.objects.get(email="v@acme.test").is_email_verified

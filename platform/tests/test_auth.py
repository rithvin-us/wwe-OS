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

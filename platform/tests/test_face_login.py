"""Touchless Owner face login/enroll.

Mocks `FaceAIClient` (the HTTP boundary to the standalone face-ai
microservice) so the decision pipeline — enroll, 1:N match, margin, liveness,
lockout — is covered without a live InsightFace/buffalo_l service. That the
microservice defaults to `buffalo_l` is a `services/face-ai` config concern
(`app/config.py::FACE_MODEL`), out of scope here.
"""

from __future__ import annotations

import io

import pytest
from auth.face_engine import FaceAIClient
from auth.models import FaceCredential, LoginAttempt

pytestmark = pytest.mark.django_db

ENROLL = "/api/v1/auth/face/enroll/"
STATUS = "/api/v1/auth/face/"
FACE_LOGIN = "/api/v1/auth/face/login/"

VECTOR_A = [1.0, 0.0, 0.0]
VECTOR_B = [0.0, 1.0, 0.0]


def _selfie(name: str = "selfie.png", colour: int = 200):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    image = Image.new("RGB", (64, 64), (colour, colour, colour))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def _patch_enroll(monkeypatch, vector: list[float]) -> None:
    monkeypatch.setattr(FaceAIClient, "enroll", lambda self, image_bytes: vector)


def _patch_verify(monkeypatch, vector: list[float], live: bool = True) -> None:
    monkeypatch.setattr(
        FaceAIClient, "verify", lambda self, image_bytes, extra_frames=None: (vector, live)
    )


def test_face_enroll_requires_auth(api, monkeypatch):
    _patch_enroll(monkeypatch, VECTOR_A)
    resp = api.post(ENROLL, {"file": _selfie()}, format="multipart")
    assert resp.status_code == 401


def test_face_enroll_stores_credential_and_status_reports_it(
    api, make_user, auth_client, monkeypatch
):
    user = make_user(email="owner@acme.test", username="owner")
    client = auth_client(user)
    _patch_enroll(monkeypatch, VECTOR_A)

    resp = client.post(ENROLL, {"file": _selfie()}, format="multipart")
    assert resp.status_code == 200
    assert resp.json()["data"]["enrolled"] is True
    assert FaceCredential.objects.filter(user=user).exists()

    status = client.get(STATUS)
    assert status.json()["data"]["enrolled"] is True


def test_face_login_matches_enrolled_user_and_issues_tokens(
    api, make_user, auth_client, monkeypatch
):
    user = make_user(email="owner@acme.test", username="owner")
    _patch_enroll(monkeypatch, VECTOR_A)
    auth_client(user).post(ENROLL, {"file": _selfie()}, format="multipart")

    _patch_verify(monkeypatch, VECTOR_A, live=True)  # same vector => cosine 1.0
    resp = api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "access" in body and "refresh" in body
    assert LoginAttempt.objects.filter(email=user.email, successful=True).exists()


def test_face_login_rejects_liveness_failure(api, make_user, auth_client, monkeypatch):
    user = make_user(email="owner@acme.test", username="owner")
    _patch_enroll(monkeypatch, VECTOR_A)
    auth_client(user).post(ENROLL, {"file": _selfie()}, format="multipart")

    _patch_verify(monkeypatch, VECTOR_A, live=False)
    resp = api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")

    assert resp.status_code == 401
    assert "iveness" in resp.json()["error"]["message"]


def test_face_login_rejects_a_different_face(api, make_user, auth_client, monkeypatch):
    user = make_user(email="owner@acme.test", username="owner")
    _patch_enroll(monkeypatch, VECTOR_A)
    auth_client(user).post(ENROLL, {"file": _selfie()}, format="multipart")

    _patch_verify(monkeypatch, VECTOR_B, live=True)  # orthogonal vector => cosine 0.0
    resp = api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")

    assert resp.status_code == 401
    assert not LoginAttempt.objects.filter(email=user.email, successful=True).exists()


def test_face_login_with_no_enrolled_credentials_is_rejected(api, monkeypatch):
    _patch_verify(monkeypatch, VECTOR_A, live=True)
    resp = api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")
    assert resp.status_code == 401


def test_face_login_locks_out_after_repeated_failures(api, make_user, auth_client, monkeypatch):
    user = make_user(email="owner@acme.test", username="owner")
    _patch_enroll(monkeypatch, VECTOR_A)
    auth_client(user).post(ENROLL, {"file": _selfie()}, format="multipart")

    _patch_verify(monkeypatch, VECTOR_B, live=True)  # never matches
    for _ in range(5):
        api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")

    # Even a genuine match is now refused while the IP is locked out.
    _patch_verify(monkeypatch, VECTOR_A, live=True)
    resp = api.post(FACE_LOGIN, {"file": _selfie()}, format="multipart")
    assert resp.status_code == 429


def test_face_revoke_removes_credential(api, make_user, auth_client, monkeypatch):
    user = make_user(email="owner@acme.test", username="owner")
    _patch_enroll(monkeypatch, VECTOR_A)
    client = auth_client(user)
    client.post(ENROLL, {"file": _selfie()}, format="multipart")

    resp = client.delete(ENROLL)
    assert resp.status_code == 200
    assert not FaceCredential.objects.filter(user=user).exists()

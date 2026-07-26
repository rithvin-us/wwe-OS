"""
Smoke tests for the Face-AI microservice (stub engine — no heavy ML deps).

Run from face-ai/:  FACE_ENGINE=stub pytest -q
The env is forced below so the suite never tries to load MTCNN/ArcFace.
"""

import os

# Force the light stub engine + a known API key BEFORE the app imports settings
# (settings are lru_cache'd at import).
os.environ["FACE_ENGINE"] = "stub"
os.environ["FACE_AI_API_KEY"] = "test-key"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
AUTH = {"X-API-Key": "test-key"}
IMG = ("selfie.jpg", b"pretend-jpeg-bytes", "image/jpeg")


def test_health_ok_no_auth():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["engine"] == "stub"
    assert body["ready"] is True


def test_version_reports_metadata():
    r = client.get("/version")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "face-ai"
    assert body["engine"] == "stub"
    assert body["embedding_dim"] == 16  # stub pseudo-embedding width


def test_enroll_returns_embedding():
    r = client.post("/enroll-face", headers=AUTH, files={"file": IMG})
    assert r.status_code == 200
    body = r.json()
    assert body["dim"] == 16
    assert len(body["embedding"]) == 16


def test_verify_returns_embedding_and_liveness():
    r = client.post("/verify-face", headers=AUTH, files={"file": IMG})
    assert r.status_code == 200
    body = r.json()
    assert body["liveness"] is True
    assert len(body["embedding"]) == 16


def test_same_image_deterministic_embedding():
    # Backend cosine relies on this: the same bytes -> the same vector.
    a = client.post("/verify-face", headers=AUTH, files={"file": IMG}).json()["embedding"]
    b = client.post("/enroll-face", headers=AUTH, files={"file": IMG}).json()["embedding"]
    assert a == b


def test_auth_required_when_key_set():
    r = client.post("/verify-face", files={"file": IMG})  # no header
    assert r.status_code == 401


def test_empty_upload_rejected():
    r = client.post(
        "/enroll-face", headers=AUTH,
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert r.status_code == 400

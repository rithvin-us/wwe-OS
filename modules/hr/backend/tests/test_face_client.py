"""
Unit tests for app.services.face_client.HttpFaceService.

ML-free and network-free: the face-ai microservice is faked with an
httpx.MockTransport so we can assert the client's resilience behaviour —
single-round-trip caching, 422 passthrough, retry, circuit breaker, local
compare and the optional stub fallback — without a running service.
"""

import httpx
import pytest

from hr.backend.services.face_client import (
    FaceServiceUnavailableError,
    HttpFaceService,
)
from hr.backend.services.face_config import FaceSettings as Settings
from hr.backend.services.face_recognition import FaceError, NoFaceDetectedError

IMG = b"pretend-jpeg-bytes"
EMB = [0.1, 0.2, 0.3, 0.4]


def _settings(**over):
    base = dict(
        FACE_ENGINE="http",
        FACE_AI_URL="http://face-ai.test",
        FACE_AI_API_KEY="k",
        FACE_AI_RETRIES=2,
        FACE_AI_BACKOFF=0.0,  # no real sleeping in tests
        FACE_AI_CB_FAIL_THRESHOLD=3,
        FACE_AI_CB_RESET_SECONDS=0.05,
    )
    base.update(over)
    return Settings(**base)


def _service(handler, **over):
    """Build an HttpFaceService whose HTTP goes to a MockTransport handler."""
    svc = HttpFaceService(_settings(**over))
    svc._client = httpx.Client(
        base_url="http://face-ai.test",
        transport=httpx.MockTransport(handler),
        headers={"X-API-Key": "k"},
    )
    return svc


def test_verify_then_embed_is_single_round_trip():
    calls = []

    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(200, json={"embedding": EMB, "liveness": True})

    svc = _service(handler)
    assert svc.verify_liveness(IMG) is True
    got = svc.embed(IMG)  # same selfie -> served from cache
    assert got == EMB
    assert calls == ["/verify-face"]  # exactly one network call


def test_enroll_uses_enroll_endpoint():
    calls = []

    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(200, json={"embedding": EMB})

    svc = _service(handler)
    assert svc.embed(IMG, enroll=True) == EMB
    assert calls == ["/enroll-face"]


def test_422_face_quality_is_surfaced_not_retried():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(422, json={"detail": "Multiple faces detected."})

    svc = _service(handler)
    with pytest.raises(FaceError) as ei:
        svc.embed(IMG, enroll=True)
    assert "Multiple faces" in str(ei.value.message)
    assert len(calls) == 1  # 4xx is a real answer -> no retry


def test_401_maps_to_service_unavailable():
    svc = _service(lambda r: httpx.Response(401, json={"detail": "nope"}))
    with pytest.raises(FaceServiceUnavailableError):
        svc.embed(IMG, enroll=True)


def test_5xx_retries_then_raises_unavailable():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(503, json={"detail": "boom"})

    svc = _service(handler)  # retries=2 -> 3 attempts
    with pytest.raises(FaceServiceUnavailableError):
        svc.embed(IMG, enroll=True)
    assert len(calls) == 3


def test_network_error_retries_then_raises():
    calls = []

    def handler(request):
        calls.append(1)
        raise httpx.ConnectError("refused", request=request)

    svc = _service(handler)
    with pytest.raises(FaceServiceUnavailableError):
        svc.verify_liveness(IMG)
    assert len(calls) == 3


def test_circuit_breaker_opens_and_fails_fast():
    calls = []

    def handler(request):
        calls.append(1)
        raise httpx.ConnectError("refused", request=request)

    # threshold=3, retries=0 so each call == one failure.
    svc = _service(handler, FACE_AI_RETRIES=0, FACE_AI_CB_FAIL_THRESHOLD=3)
    for _ in range(3):
        with pytest.raises(FaceServiceUnavailableError):
            svc.embed(IMG, enroll=True)
    assert len(calls) == 3
    # Breaker now OPEN — next call must fail fast without touching the network.
    with pytest.raises(FaceServiceUnavailableError):
        svc.embed(IMG, enroll=True)
    assert len(calls) == 3  # unchanged: no new request issued


def test_compare_is_local_no_http():
    def handler(request):  # must never be called
        raise AssertionError("compare must not hit the network")

    svc = _service(handler)
    assert svc.compare(EMB, EMB) == pytest.approx(1.0)
    with pytest.raises(NoFaceDetectedError):
        svc.compare(EMB, [])


def test_fallback_stub_on_outage():
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    svc = _service(handler, FACE_AI_FALLBACK_STUB=True, FACE_AI_RETRIES=0)
    # Stub returns a deterministic 16-dim embedding instead of erroring.
    emb = svc.embed(IMG, enroll=True)
    assert len(emb) == 16
    assert svc.verify_liveness(IMG) is True

"""
HttpFaceService — talks to the standalone face-ai microservice over HTTP.

This is the production face engine (FACE_ENGINE=http). It implements the same
`FaceRecognitionService` strategy interface the rest of the backend already
depends on, so `app.api.enroll` and `app.api.attendance` need NO changes — they
keep calling `get_face_service().embed(...)` / `.verify_liveness(...)` and get a
remote-backed implementation instead of an in-process one.

Design
  * embed()/verify_liveness() are delegated to face-ai; compare()/serialize()/
    deserialize() stay LOCAL (pure cosine + JSON) so the enrolled gallery never
    leaves the HR database and there is no HTTP call per candidate.
  * The check-in flow calls verify_liveness(bytes) then embed(bytes) on the SAME
    selfie. To avoid two round-trips, verify_liveness caches the /verify-face
    result keyed by the image hash; the following embed() consumes that cache.
  * Resilience: pooled httpx client (keep-alive), bounded timeout, exponential
    retry on transient (network/5xx) failures only, and a circuit breaker that
    trips OPEN after repeated failures to fail fast instead of hanging check-ins.
  * A face-quality answer from the service (HTTP 422) is a real result, not a
    fault — it is surfaced immediately as a FaceError (no retry, breaker unaffected).
"""

from __future__ import annotations

import atexit
import hashlib
import logging
import threading
import time
from collections import OrderedDict

import httpx

from hr.backend.services.face_config import FaceSettings as Settings
from hr.backend.services.face_recognition import (
    FaceError,
    FaceRecognitionService,
    NoFaceDetectedError,
    StubFaceService,
    cosine_similarity,
)

logger = logging.getLogger(__name__)


class FaceServiceUnavailableError(FaceError):
    """The face-ai service could not be reached / is circuit-open (HTTP 503)."""

    status_code = 503
    default_message = "Face service temporarily unavailable. Please try again."


# ── circuit breaker ──────────────────────────────────────────────────────────
class _CircuitBreaker:
    """Minimal thread-safe breaker: CLOSED → OPEN → HALF_OPEN → CLOSED.

    Counts consecutive transient failures. At `fail_threshold` it trips OPEN and
    rejects calls for `reset_seconds`; the next call after that is allowed
    through (HALF_OPEN) and either closes the breaker (success) or re-opens it.
    """

    CLOSED, OPEN, HALF_OPEN = "closed", "open", "half_open"

    def __init__(self, fail_threshold: int, reset_seconds: float):
        self._fail_threshold = max(1, fail_threshold)
        self._reset_seconds = reset_seconds
        self._state = self.CLOSED
        self._failures = 0
        self._opened_at = 0.0
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            if self._state == self.OPEN:
                if (time.monotonic() - self._opened_at) >= self._reset_seconds:
                    self._state = self.HALF_OPEN
                    logger.info("face-ai circuit HALF_OPEN (probing)")
                    return True
                return False
            return True

    def record_success(self) -> None:
        with self._lock:
            if self._state != self.CLOSED:
                logger.info("face-ai circuit CLOSED (recovered)")
            self._state = self.CLOSED
            self._failures = 0

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._state == self.HALF_OPEN or self._failures >= self._fail_threshold:
                if self._state != self.OPEN:
                    logger.warning("face-ai circuit OPEN after %d failure(s)", self._failures)
                self._state = self.OPEN
                self._opened_at = time.monotonic()

    @property
    def state(self) -> str:
        return self._state


class HttpFaceService(FaceRecognitionService):
    """Remote face engine backed by the face-ai microservice."""

    def __init__(self, settings: Settings):
        self._base_url = settings.FACE_AI_URL.rstrip("/")
        self._api_key = settings.FACE_AI_API_KEY
        self._retries = max(0, settings.FACE_AI_RETRIES)
        self._backoff = settings.FACE_AI_BACKOFF
        self._fallback_stub = settings.FACE_AI_FALLBACK_STUB
        self._breaker = _CircuitBreaker(
            settings.FACE_AI_CB_FAIL_THRESHOLD, settings.FACE_AI_CB_RESET_SECONDS
        )
        # Pooled, keep-alive client reused for every request.
        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=httpx.Timeout(
                settings.FACE_AI_TIMEOUT, connect=settings.FACE_AI_CONNECT_TIMEOUT
            ),
            headers={"X-API-Key": self._api_key} if self._api_key else {},
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        # Tiny hash-keyed cache so verify_liveness()+embed() on one selfie is a
        # single round-trip. Bounded; entries are consumed by embed().
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._stub = StubFaceService() if self._fallback_stub else None
        # Close the pooled client at interpreter exit so keep-alive sockets are
        # released cleanly (the service is a process-wide singleton).
        atexit.register(self.close)
        logger.info("HttpFaceService -> %s (fallback_stub=%s)", self._base_url, self._fallback_stub)

    def close(self) -> None:
        """Close the pooled HTTP client and release its connections."""
        try:
            self._client.close()
        except Exception:  # noqa: BLE001 - shutdown best-effort
            pass

    # -- cache helpers ----------------------------------------------------
    @staticmethod
    def _key(image_bytes: bytes) -> str:
        return hashlib.sha256(image_bytes).hexdigest()

    def _cache_put(self, key: str, value: dict) -> None:
        with self._cache_lock:
            self._cache[key] = value
            self._cache.move_to_end(key)
            while len(self._cache) > 8:
                self._cache.popitem(last=False)

    def _cache_pop(self, key: str) -> dict | None:
        with self._cache_lock:
            return self._cache.pop(key, None)

    # -- HTTP with retry + breaker ---------------------------------------
    def _post_face(
        self, path: str, image_bytes: bytes, extra_frames: list[bytes] | None = None
    ) -> dict:
        """POST an image (plus optional burst frames) to the service; return the
        parsed JSON body.

        Retries transient failures (network / 5xx); surfaces a 4xx face-quality
        answer as a FaceError immediately. Trips the circuit breaker on repeated
        transient failure and raises FaceServiceUnavailableError.
        """
        if not self._breaker.allow():
            logger.warning("face-ai circuit OPEN — failing fast for %s", path)
            return self._fallback_or_raise("circuit open", image_bytes, path)

        files: list[tuple[str, tuple[str, bytes, str]]] = [
            ("file", ("capture.jpg", image_bytes, "image/jpeg"))
        ]
        for i, frame in enumerate(extra_frames or []):
            files.append(("frames", (f"frame{i}.jpg", frame, "image/jpeg")))
        last_exc: Exception | None = None
        for attempt in range(self._retries + 1):
            try:
                resp = self._client.post(path, files=files)
            except httpx.HTTPError as exc:  # connect/read/timeout
                last_exc = exc
                self._breaker.record_failure()
                logger.warning(
                    "face-ai %s network error (attempt %d/%d): %s",
                    path,
                    attempt + 1,
                    self._retries + 1,
                    exc,
                )
            else:
                if resp.status_code < 400:
                    self._breaker.record_success()
                    return resp.json()
                if 400 <= resp.status_code < 500:
                    # A real answer (bad image / auth) — do NOT retry, do NOT
                    # count against the breaker. Surface the service's message.
                    self._breaker.record_success()
                    self._raise_client_error(resp)
                # 5xx — transient, retry
                last_exc = httpx.HTTPStatusError(
                    f"{resp.status_code}", request=resp.request, response=resp
                )
                self._breaker.record_failure()
                logger.warning(
                    "face-ai %s server error %d (attempt %d/%d)",
                    path,
                    resp.status_code,
                    attempt + 1,
                    self._retries + 1,
                )
            if attempt < self._retries:
                time.sleep(self._backoff * (2**attempt))

        logger.error("face-ai %s exhausted retries: %s", path, last_exc)
        return self._fallback_or_raise(str(last_exc), image_bytes, path)

    def _raise_client_error(self, resp: httpx.Response) -> None:
        try:
            detail = resp.json().get("detail", "")
        except Exception:  # noqa: BLE001
            detail = resp.text
        if resp.status_code == 401:
            logger.error("face-ai rejected API key (401): %s", detail)
            raise FaceError(
                "Face-AI authentication failed (401): FACE_AI_API_KEY on your "
                "local desktop service does not match HR_FACE_AI_API_KEY on web platform. "
                "Leave FACE_AI_API_KEY blank in services/face-ai/.env for local dev."
            )
        # 422 (and other 4xx) carry a user-safe face-quality message.
        raise FaceError(detail or "Face could not be processed")

    def _fallback_or_raise(self, reason: str, image_bytes: bytes, path: str) -> dict:
        if self._stub is not None:
            logger.warning("face-ai unavailable (%s) — using stub fallback", reason)
            if path == "/verify-face":
                return {
                    "embedding": self._stub.embed(image_bytes),
                    "liveness": self._stub.verify_liveness(image_bytes),
                }
            return {"embedding": self._stub.embed(image_bytes, enroll=True)}
        raise FaceServiceUnavailableError()

    # -- FaceRecognitionService interface --------------------------------
    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        if not image_bytes:
            raise NoFaceDetectedError()
        if enroll:
            return self._post_face("/enroll-face", image_bytes)["embedding"]
        # Verification path: reuse a cached /verify-face result if verify_liveness
        # already fetched it for this exact selfie; otherwise fetch now.
        cached = self._cache_pop(self._key(image_bytes))
        if cached is not None:
            return cached["embedding"]
        return self._post_face("/verify-face", image_bytes)["embedding"]

    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        if not image_bytes:
            raise NoFaceDetectedError()
        body = self._post_face("/verify-face", image_bytes, extra_frames)
        # Cache the whole result so the following embed() needs no second call.
        self._cache_put(self._key(image_bytes), body)
        return bool(body.get("liveness", True))

    def compare(self, a: list[float], b: list[float]) -> float:
        # Pure cosine, computed locally — templates never go over the wire.
        if not a or not b:
            raise NoFaceDetectedError("Missing face embedding")
        return cosine_similarity(a, b)

    def health(self) -> dict:
        """Fetch the service /health (used by diagnostics / smoke tests)."""
        resp = self._client.get("/health")
        resp.raise_for_status()
        return resp.json()

"""Face-AI client for touchless Owner login.

Talks to the standalone face-ai microservice (`services/face-ai` — MTCNN
detection + InsightFace ArcFace, model `buffalo_l` by default) over HTTP.
`platform/` never imports `modules/` (see repo CLAUDE.md), so this is a small,
self-contained client rather than a reuse of `modules/hr/backend/services/
face_client.py` — the two duplicate a little code on purpose, same as the
face-ai service itself is a standalone deploy that shares no code with either
caller (services integrate over HTTP, not source imports).

embed()/verify_liveness() happen on the face-ai service; the cosine compare
against enrolled templates stays local (`auth.services.AuthService`) so a face
template never leaves this database.
"""

from __future__ import annotations

import json
import logging
import math

import httpx
from django.conf import settings
from shared.exceptions import PlatformError

logger = logging.getLogger("platform.auth.face")


class FaceError(PlatformError):
    """A face-quality or recognition failure from the face-ai service."""

    status_code = 422
    default_code = "face_error"
    default_detail = "Face could not be processed."


class FaceServiceUnavailableError(PlatformError):
    """The face-ai microservice could not be reached."""

    status_code = 503
    default_code = "face_service_unavailable"
    default_detail = (
        "Face service temporarily unavailable. Please try again or sign in with your password."
    )


def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    """Cosine similarity of two equal-length vectors, in [-1, 1] (0 if degenerate)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def serialize(embedding: list[float]) -> str:
    return json.dumps(embedding)


def deserialize(blob: str | None) -> list[float] | None:
    if not blob:
        return None
    try:
        return json.loads(blob)
    except (ValueError, TypeError):
        return None


class FaceAIClient:
    """Thin, synchronous client for the face-ai microservice's two endpoints."""

    def __init__(self) -> None:
        self._base_url = settings.FACE_AI_URL.rstrip("/")
        self._api_key = settings.FACE_AI_API_KEY
        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=httpx.Timeout(
                settings.FACE_AI_TIMEOUT, connect=settings.FACE_AI_CONNECT_TIMEOUT
            ),
            headers={"X-API-Key": self._api_key} if self._api_key else {},
        )

    def _post(self, path: str, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> dict:
        files: list[tuple[str, tuple[str, bytes, str]]] = [
            ("file", ("capture.jpg", image_bytes, "image/jpeg"))
        ]
        for i, frame in enumerate(extra_frames or []):
            files.append(("frames", (f"frame{i}.jpg", frame, "image/jpeg")))
        try:
            resp = self._client.post(path, files=files)
        except httpx.HTTPError as exc:
            logger.warning("face-ai %s network error: %s", path, exc)
            raise FaceServiceUnavailableError() from exc

        if resp.status_code >= 500:
            logger.warning("face-ai %s server error %d", path, resp.status_code)
            raise FaceServiceUnavailableError()
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", "")
            except Exception:  # noqa: BLE001 - malformed error body from the service
                detail = resp.text
            raise FaceError(detail or "Face could not be processed.")
        return resp.json()

    def enroll(self, image_bytes: bytes) -> list[float]:
        """Strict-quality embedding for a reference face (blur/side-profile rejected)."""
        return self._post("/enroll-face", image_bytes)["embedding"]

    def verify(
        self, image_bytes: bytes, extra_frames: list[bytes] | None = None
    ) -> tuple[list[float], bool]:
        """Embedding + liveness verdict for a login attempt selfie/burst."""
        body = self._post("/verify-face", image_bytes, extra_frames)
        return body["embedding"], bool(body.get("liveness", True))

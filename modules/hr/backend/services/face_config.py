"""Face-engine and check-in settings.

A stand-in for the legacy app's `app.config.Settings`, exposing exactly the
attribute names `face_recognition.py` and `face_client.py` read, so those two
files — the verified face-matching and microservice-client logic, including its
retry/circuit-breaker behaviour — are copied across unchanged
(docs/specs/hr-migration.md § 3).

Environment-driven with the legacy defaults, so a deployment that sets nothing
behaves exactly as it did before. The defaults are deliberately conservative:
`FACE_ENGINE=stub` needs no ML dependencies at all.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _str(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


def _float(name: str, default: float) -> float:
    try:
        return float(_str(name, str(default)))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(_str(name, str(default)))
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    return _str(name, "true" if default else "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@dataclass
class FaceSettings:
    """Check-in decision thresholds, site geofence, and face-engine wiring."""

    # ---- Site geofence ---------------------------------------------------- #
    # Check-ins are auto-approved only within SITE_RADIUS_M metres of
    # (SITE_LAT, SITE_LON). Defaults point at the Coimbatore site.
    SITE_LAT: float = field(default_factory=lambda: _float("HR_SITE_LAT", 11.0785))
    SITE_LON: float = field(default_factory=lambda: _float("HR_SITE_LON", 77.0057))
    SITE_RADIUS_M: float = field(default_factory=lambda: _float("HR_SITE_RADIUS_M", 250.0))
    GEOFENCE_ENABLED: bool = field(default_factory=lambda: _bool("HR_GEOFENCE_ENABLED", False))

    # ---- Match thresholds ------------------------------------------------- #
    FACE_MATCH_THRESHOLD: float = field(
        default_factory=lambda: _float("HR_FACE_MATCH_THRESHOLD", 0.45)
    )
    # A 1:N identification only counts if the best match beats the runner-up by
    # this margin — without it, two similar faces could resolve arbitrarily.
    FACE_IDENTIFY_MARGIN: float = field(
        default_factory=lambda: _float("HR_FACE_IDENTIFY_MARGIN", 0.05)
    )
    # Minimum gap between two successful punches for one employee.
    PUNCH_COOLDOWN_MINUTES: int = field(
        default_factory=lambda: _int("HR_PUNCH_COOLDOWN_MINUTES", 1)
    )

    FACE_ENGINE: str = field(
        default_factory=lambda: _str(
            "HR_FACE_ENGINE",
            "http" if _str("HR_FACE_AI_URL", "") or _str("FACE_AI_URL", "") else "stub",
        )
    )

    # ---- face-ai microservice client (FACE_ENGINE=http) ------------------- #
    FACE_AI_URL: str = field(
        default_factory=lambda: _str("HR_FACE_AI_URL", _str("FACE_AI_URL", "http://localhost:9000"))
    )
    # Shared secret sent as X-API-Key; must equal FACE_AI_API_KEY on the service.
    FACE_AI_API_KEY: str = field(default_factory=lambda: _str("HR_FACE_AI_API_KEY", ""))
    FACE_AI_TIMEOUT: float = field(default_factory=lambda: _float("HR_FACE_AI_TIMEOUT", 10.0))
    FACE_AI_CONNECT_TIMEOUT: float = field(
        default_factory=lambda: _float("HR_FACE_AI_CONNECT_TIMEOUT", 3.0)
    )
    FACE_AI_RETRIES: int = field(default_factory=lambda: _int("HR_FACE_AI_RETRIES", 2))
    FACE_AI_BACKOFF: float = field(default_factory=lambda: _float("HR_FACE_AI_BACKOFF", 0.3))
    # Circuit breaker: after this many consecutive failures the client fails fast
    # for FACE_AI_CB_RESET_SECONDS, then probes once (HALF_OPEN).
    FACE_AI_CB_FAIL_THRESHOLD: int = field(
        default_factory=lambda: _int("HR_FACE_AI_CB_FAIL_THRESHOLD", 5)
    )
    FACE_AI_CB_RESET_SECONDS: float = field(
        default_factory=lambda: _float("HR_FACE_AI_CB_RESET_SECONDS", 30.0)
    )
    FACE_AI_FALLBACK_STUB: bool = field(
        default_factory=lambda: _bool("HR_FACE_AI_FALLBACK_STUB", False)
    )

    # ---- InsightFace (FACE_ENGINE=insightface only) ----------------------- #
    FACE_MODEL: str = field(default_factory=lambda: _str("HR_FACE_MODEL", "buffalo_s"))
    FACE_DETECTOR: str = field(default_factory=lambda: _str("HR_FACE_DETECTOR", "mtcnn"))

    # ---- Face-quality gates ----------------------------------------------- #
    MAX_FACE_IMAGE_SIZE: int = field(default_factory=lambda: _int("HR_MAX_FACE_IMAGE_SIZE", 1024))
    FACE_MIN_SIZE_PX: int = field(default_factory=lambda: _int("HR_FACE_MIN_SIZE_PX", 60))
    FACE_DETECT_MIN_CONFIDENCE: float = field(
        default_factory=lambda: _float("HR_FACE_DETECT_MIN_CONFIDENCE", 0.90)
    )
    FACE_BLUR_MIN_VAR: float = field(default_factory=lambda: _float("HR_FACE_BLUR_MIN_VAR", 40.0))
    FACE_SIDE_PROFILE_MAX_RATIO: float = field(
        default_factory=lambda: _float("HR_FACE_SIDE_PROFILE_MAX_RATIO", 0.35)
    )
    FACE_SAVE_DEBUG_IMAGES: bool = field(
        default_factory=lambda: _bool("HR_FACE_SAVE_DEBUG_IMAGES", False)
    )

    # ---- Liveness (anti-spoofing) ----------------------------------------- #
    FACE_ENABLE_LIVENESS: bool = field(
        default_factory=lambda: _bool("HR_FACE_ENABLE_LIVENESS", True)
    )
    FACE_LIVENESS_MIN_VAR: float = field(
        default_factory=lambda: _float("HR_FACE_LIVENESS_MIN_VAR", 60.0)
    )
    FACE_LIVENESS_MIN_MOTION: float = field(
        default_factory=lambda: _float("HR_FACE_LIVENESS_MIN_MOTION", 0.003)
    )
    FACE_LIVENESS_MAX_MOTION: float = field(
        default_factory=lambda: _float("HR_FACE_LIVENESS_MAX_MOTION", 0.35)
    )
    FACE_LIVENESS_EYE_DELTA: float = field(
        default_factory=lambda: _float("HR_FACE_LIVENESS_EYE_DELTA", 0.08)
    )


@lru_cache(maxsize=1)
def get_settings() -> FaceSettings:
    return FaceSettings()

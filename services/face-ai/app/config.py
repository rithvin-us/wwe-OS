"""
Face-AI microservice configuration.

Everything is configurable via ENV / a local .env (see .env.example). The
service is deliberately independent of the HR backend: it shares no code and
holds no gallery — it only turns an image into a face embedding (+ a liveness
flag). The backend owns the enrolled templates and does the 1:N cosine match.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # -- service identity ------------------------------------------------
    SERVICE_NAME: str = "face-ai"
    SERVICE_VERSION: str = "1.0.0"

    # -- security --------------------------------------------------------
    # Shared secret required in the `X-API-Key` header on every /enroll-face
    # and /verify-face call. Because the service is exposed publicly through a
    # Cloudflare Tunnel, leave this UNSET only for local testing. When set, the
    # backend must send the same value (HR_FACE_AI_API_KEY / FACE_AI_API_KEY
    # there). Provided via env only — never hardcode a real key here (a leaked
    # default in the repo is a public credential).
    FACE_AI_API_KEY: str = ""

    # CORS: comma-separated browser origins allowed to call the service. Empty
    # (the default) means NO browser origin — the service is called
    # server-to-server from the Django backend, which is CORS-exempt. The
    # browser at app.water-works.in must never hit this service directly.
    FACE_AI_CORS_ORIGINS: str = ""

    # Per-client rate limits (slowapi syntax, e.g. "30/minute"). Keyed on the
    # real client IP (CF-Connecting-IP when fronted by Cloudflare). Each request
    # runs face matching, so keep these low.
    FACE_AI_RATE_VERIFY: str = "30/minute"
    FACE_AI_RATE_ENROLL: str = "10/minute"

    # -- engine selection ------------------------------------------------
    # "insightface" = real MTCNN + ArcFace (needs requirements-ml.txt + ~1GB RAM).
    # "stub"        = deterministic pseudo-embedding, zero heavy deps (tests/CI).
    FACE_ENGINE: str = "insightface"
    FACE_MODEL: str = "buffalo_l"  # buffalo_s (light & fast) | buffalo_l (heavy & accurate)
    FACE_DETECTOR: str = "mtcnn"  # only mtcnn implemented
    FACE_USE_GPU: bool = False  # use cuda (requires torch+onnxruntime-gpu)

    # -- preprocessing / detection gates (mirror the backend defaults) ---
    MAX_FACE_IMAGE_SIZE: int = 1024
    FACE_MIN_SIZE_PX: int = 60
    FACE_DETECT_MIN_CONFIDENCE: float = 0.90
    FACE_BLUR_MIN_VAR: float = 40.0
    FACE_SIDE_PROFILE_MAX_RATIO: float = 0.35

    # -- liveness --------------------------------------------------------
    FACE_ENABLE_LIVENESS: bool = True
    FACE_LIVENESS_MIN_VAR: float = 60.0
    # Multi-frame liveness (burst frames ~400 ms apart): consecutive-frame
    # mean |Δ| band [MIN_MOTION, MAX_MOTION]; eye-patch change ≥ EYE_DELTA and
    # ≥ 2× global motion counts as a blink (mirror the backend defaults).
    FACE_LIVENESS_MIN_MOTION: float = 0.003
    FACE_LIVENESS_MAX_MOTION: float = 0.35
    FACE_LIVENESS_EYE_DELTA: float = 0.08

    # -- debug -----------------------------------------------------------
    FACE_SAVE_DEBUG_IMAGES: bool = False
    DEBUG_IMAGE_DIR: str = "generated/face_debug"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

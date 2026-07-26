"""
Face-AI microservice — FastAPI app.

Endpoints
    POST /enroll-face   strict-gate embedding for a reference photo (admin enrol)
    POST /verify-face   liveness + probe embedding for a check-in selfie
    GET  /health        liveness/readiness probe (no auth) — for Cloudflare/Render
    GET  /version       build + model metadata (no auth)

Security
    /enroll-face and /verify-face require the `X-API-Key` header to equal
    settings.FACE_AI_API_KEY (when that is set). The service is meant to sit
    behind a Cloudflare Tunnel, so the key is the app-layer gate on top of TLS.

Model lifecycle
    The heavy MTCNN + ArcFace models are loaded ONCE in the lifespan startup
    (warm start). If that fails (e.g. ML deps missing) the service still boots
    and /health reports ready=false; the first face request then lazily retries
    the load and surfaces a clear 503 if it still cannot.
"""

import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.engine import FaceError, build_engine
from app.schemas import (
    EmbedResponse,
    HealthResponse,
    VerifyResponse,
    VersionResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("face-ai")

settings = get_settings()

# ── engine lifecycle ─────────────────────────────────────────────────────────
_engine = build_engine(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm the models once at startup so the first request pays no load cost."""
    loader = getattr(_engine, "load", None)
    if loader is not None:  # stub engine has none
        try:
            loader()
            logger.info("engine '%s' warmed up", settings.FACE_ENGINE)
        except Exception:  # noqa: BLE001 - boot anyway; /health reports not-ready
            logger.exception("engine warm-up failed; will lazily retry on first request")
    yield


app = FastAPI(
    title="Face-AI Service",
    description="Standalone face embedding + liveness microservice for HR attendance",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def _ensure_ready():
    """Return a ready engine, lazily loading it if warm-up was skipped/failed."""
    if not _engine.ready:
        loader = getattr(_engine, "load", None)
        if loader is not None:
            try:
                loader()
            except Exception as exc:  # noqa: BLE001
                logger.exception("lazy model load failed")
                raise HTTPException(
                    status_code=503,
                    detail="Face engine not available (model load failed)",
                ) from exc
    return _engine


# ── auth ─────────────────────────────────────────────────────────────────────
def _require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Constant-time check of the shared API key (skipped when unset)."""
    expected = settings.FACE_AI_API_KEY
    if not expected:
        return  # auth disabled (local/dev)
    # hmac.compare_digest avoids the timing side-channel of `!=` (which returns
    # on the first differing byte, leaking the key length/prefix to an attacker).
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ── routes ───────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        engine=settings.FACE_ENGINE,
        model=settings.FACE_MODEL,
        ready=_engine.ready,
    )


@app.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        engine=settings.FACE_ENGINE,
        model=settings.FACE_MODEL,
        detector=settings.FACE_DETECTOR,
        embedding_dim=_engine.embedding_dim,
    )


@app.post("/enroll-face", response_model=EmbedResponse, dependencies=[Depends(_require_api_key)])
async def enroll_face(file: UploadFile = File(..., description="Reference face photo")):
    """Strict-gate embedding for enrolment (rejects blurry/side/multiple/small)."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")
    engine = _ensure_ready()
    try:
        # embed() is CPU-heavy and synchronous — run it in the threadpool so it
        # doesn't block the event loop and stall other concurrent requests.
        embedding = await run_in_threadpool(engine.embed, image_bytes, True)
    except FaceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    return EmbedResponse(
        embedding=embedding,
        dim=len(embedding),
        engine=settings.FACE_ENGINE,
        model=settings.FACE_MODEL,
    )


@app.post("/verify-face", response_model=VerifyResponse, dependencies=[Depends(_require_api_key)])
async def verify_face(
    file: UploadFile = File(..., description="Live-captured selfie"),
    frames: list[UploadFile] | None = File(
        None, description="Optional liveness burst: extra frames ~400 ms apart"
    ),
):
    """Liveness + probe embedding for a check-in.

    The 1:N match against enrolled templates is done by the CALLER (the backend),
    so the enrolled gallery never leaves the HR database. This endpoint returns
    the probe embedding plus the liveness flag; the backend runs the cosine.
    Extra `frames` (capped) feed the micro-movement/blink liveness analysis.
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")
    extra_frames = [await f.read() for f in (frames or [])[:4]]
    extra_frames = [f for f in extra_frames if f]
    engine = _ensure_ready()
    try:
        # Offload the CPU-heavy model calls to the threadpool (see enroll_face).
        liveness = await run_in_threadpool(engine.verify_liveness, image_bytes, extra_frames)
        embedding = await run_in_threadpool(engine.embed, image_bytes, False)
    except FaceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    return VerifyResponse(
        embedding=embedding,
        dim=len(embedding),
        liveness=liveness,
        engine=settings.FACE_ENGINE,
        model=settings.FACE_MODEL,
    )

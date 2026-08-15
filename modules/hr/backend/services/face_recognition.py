"""
Face Recognition — MTCNN detection + InsightFace ArcFace (buffalo_l by default) recognition.

Pluggable interface for self-service attendance. An admin enrols a reference
face per employee (embedding stored on the employee row); at each check-in the
freshly captured selfie is embedded and compared (cosine similarity) against the
enrolled templates to identify who is punching (1:N). A silent liveness check
resists flat photo/screen presentation attacks.

────────────────────────────────────────────────────────────────────────────
MODEL LOADING (requirement 9)
    Models are heavy, so they are loaded EXACTLY ONCE and reused for every
    request. `get_face_service()` is @lru_cache'd, so the first call builds the
    service and every later call returns that same instance. `app.main` warms it
    up in the FastAPI lifespan (startup), so the first real request pays no load
    cost. The models are never reloaded per request.

ENROLLMENT FLOW (requirement 4) — app.api.enroll -> embed(bytes, enroll=True):
    preprocess -> detect exactly one face -> reject blurry / side-profile /
    multiple / too-small -> align+crop -> ArcFace embedding -> store JSON on the
    employee. Raw images are NEVER saved (only the embedding), unless
    FACE_SAVE_DEBUG_IMAGES=True, which writes the aligned crop for debugging.

VERIFICATION FLOW (requirement 5) — app.api.attendance /checkin:
    verify_liveness(bytes) -> embed(bytes) [detect -> align -> ArcFace] ->
    compare(probe, enrolled) cosine for each enrolled employee -> best match if
    it clears FACE_MATCH_THRESHOLD (and beats runner-up by FACE_IDENTIFY_MARGIN,
    in attendance_punch.identify_employee). Returns employee id/name, similarity
    score, confidence and match/no-match to the caller.

CONFIGURABLE THRESHOLDS (requirement 6) — all in app.config.Settings / .env:
    FACE_MATCH_THRESHOLD  cosine at/above which a face is accepted (0.36)
    FACE_MODEL            InsightFace pack: buffalo_s (small) / buffalo_l
    FACE_DETECTOR         detector backend (mtcnn)
    MAX_FACE_IMAGE_SIZE   longest side images are downscaled to (1024)
    FACE_MIN_SIZE_PX / FACE_DETECT_MIN_CONFIDENCE / FACE_BLUR_MIN_VAR /
    FACE_SIDE_PROFILE_MAX_RATIO   detection & enrolment quality gates
    FACE_ENABLE_LIVENESS / FACE_LIVENESS_MIN_VAR   silent anti-spoof heuristic

HOW TO SWITCH DETECTOR IN THE FUTURE (requirement 10):
    Detection is isolated in InsightFaceService._detect(), which returns
    (box, landmarks[5x2], confidence). To swap MTCNN for another detector
    (RetinaFace / SCRFD / MediaPipe), add a branch keyed on FACE_DETECTOR in
    _load_detector() that populates self._detect_fn, and make it return the same
    tuple with 5 landmarks in ArcFace order [left_eye, right_eye, nose,
    left_mouth, right_mouth]. Nothing else in the pipeline changes.

Engines behind FaceRecognitionService (selected by FACE_ENGINE):
  * StubFaceService ("stub") — NO real model. Deterministic pseudo-embedding
    from the image bytes; compare() is a real cosine over those, so the SAME
    image scores ~1.0 and a different image ~0. Exercises both decision paths
    with zero heavy deps. Liveness always passes. NOT a real matcher.
  * InsightFaceService ("insightface") — MTCNN detection + InsightFace ArcFace
    embeddings, plus a Laplacian-variance silent liveness check. Heavy deps
    (numpy, cv2, PIL, facenet-pytorch, insightface) are imported lazily so this
    module and the stub path load fine when they are not installed.

Templates are stored as JSON (list[float]); raw images are never persisted.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import math
import time
from abc import ABC, abstractmethod
from functools import lru_cache

from hr.backend.services.face_config import get_settings

logger = logging.getLogger(__name__)


# ── Error hierarchy (requirement 8) ──────────────────────────────────────────
# Every face-quality/recognition failure carries a user-safe `.message` and a
# 422 status. The enrol and check-in endpoints catch FaceError and surface the
# message, so the user gets a clear reason (no face / multiple faces / blurry /
# too small / side profile) instead of a 500.
class FaceError(Exception):
    """Base for face detection / quality / recognition failures."""

    status_code = 422
    default_message = "Face could not be processed"

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class NoFaceDetectedError(FaceError):
    """No detectable face in the image (bad framing, empty/unreadable frame)."""

    default_message = "No face detected. Position your face clearly in the frame."


class MultipleFacesError(FaceError):
    """More than one face detected — check-in/enrolment needs exactly one."""

    default_message = "Multiple faces detected. Only one person may be in frame."


class FaceTooSmallError(FaceError):
    """The detected face is too small (too far from the camera / low res)."""

    default_message = "Face too small. Move closer to the camera."


class BlurryFaceError(FaceError):
    """The face is too blurry/out of focus to enrol reliably."""

    default_message = "Face too blurry. Hold still and use a sharp, well-lit photo."


class SideProfileError(FaceError):
    """The face is turned too far (side profile) — enrolment needs a frontal face."""

    default_message = "Face not frontal. Look straight at the camera."


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity of two equal-length vectors, in [-1, 1] (0 if degenerate)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def to_confidence(score: float) -> float:
    """Map a cosine similarity to a 0-100 confidence percentage (clamped).

    Calibrated biometrics confidence scaling for ArcFace embeddings:
      - score <= 0.0 -> 0.0%
      - score >= 1.0 -> 100.0%
      - score in [0.0, 0.36) -> scaled [0.0, 75.0]%
      - score in [0.36, 1.0] -> scaled [80.0, 100.0]%
    """
    if score <= 0.0:
        return 0.0
    if score >= 1.0:
        return 100.0
    if score < 0.36:
        return round((score / 0.36) * 75.0, 1)
    return round(80.0 + ((score - 0.36) / (1.0 - 0.36)) * 20.0, 1)


class FaceRecognitionService(ABC):
    """Strategy interface for face embedding, comparison and liveness."""

    @abstractmethod
    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        """Return a face template (embedding vector) for an image.

        `enroll=True` applies the stricter enrolment quality gates (blur and
        side-profile rejection). Raises a FaceError subclass when the image is
        unusable (no face / multiple faces / too small / blurry / side profile).
        """

    @abstractmethod
    def compare(self, a: list[float], b: list[float]) -> float:
        """Return a similarity score between two templates (higher = closer)."""

    @abstractmethod
    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        """Return True if the capture looks like a live face, not a flat spoof.

        `extra_frames` is an optional short burst captured after the primary
        image (~400 ms apart). Engines that support motion analysis use it for
        micro-movement / blink detection; single-image callers omit it and get
        the texture-only check.

        Raises NoFaceDetectedError when the image cannot be read.
        """

    # -- helpers shared by all engines ------------------------------------
    @staticmethod
    def serialize(embedding: list[float]) -> str:
        return json.dumps(embedding)

    @staticmethod
    def deserialize(blob: str | None) -> list[float] | None:
        if not blob:
            return None
        try:
            return json.loads(blob)
        except (ValueError, TypeError):
            return None


class StubFaceService(FaceRecognitionService):
    """Fixture engine for the PoC — see module docstring. NOT a real matcher."""

    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        # Deterministic pseudo-embedding from the image bytes. Centred to
        # [-1, 1] so two *different* images are near-orthogonal (cosine ~0)
        # while the SAME image scores 1.0 — this makes 1:N identification
        # discriminate in the stub path. `enroll` is ignored (no quality model).
        if not image_bytes:
            raise NoFaceDetectedError()
        digest = hashlib.sha256(image_bytes).digest()
        return [(b - 127.5) / 127.5 for b in digest[:16]]

    def compare(self, a: list[float], b: list[float]) -> float:
        # Real cosine over the pseudo-embeddings: identical image -> ~1.0,
        # different image -> ~0. Enough to exercise identify + both decision
        # paths without a real model.
        return cosine_similarity(a, b)

    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        # The stub performs no anti-spoofing.
        return True


class InsightFaceService(FaceRecognitionService):
    """Real face engine: MTCNN detection + InsightFace ArcFace (buffalo_l by default).

    All heavy imports (numpy, cv2, PIL, facenet-pytorch, insightface) happen at
    construction/first-use so this class can be *defined* even when those
    packages are absent — only building the service (FACE_ENGINE=insightface)
    requires them installed. The models are loaded once here and reused.
    """

    def __init__(
        self,
        *,
        model_name: str,
        detector: str,
        max_image_size: int,
        min_face_px: int,
        det_min_confidence: float,
        blur_min_var: float,
        side_profile_max_ratio: float,
        liveness_enabled: bool,
        liveness_min_var: float,
        liveness_min_motion: float = 0.003,
        liveness_max_motion: float = 0.35,
        liveness_eye_delta: float = 0.08,
        save_debug: bool,
    ):
        self._model_name = model_name
        self._detector = (detector or "mtcnn").lower()
        self._max_size = max_image_size
        self._min_face_px = min_face_px
        self._det_min_conf = det_min_confidence
        self._blur_min_var = blur_min_var
        self._side_profile_max_ratio = side_profile_max_ratio
        self._liveness_enabled = liveness_enabled
        self._liveness_min_var = liveness_min_var
        self._liveness_min_motion = liveness_min_motion
        self._liveness_max_motion = liveness_max_motion
        self._liveness_eye_delta = liveness_eye_delta
        self._save_debug = save_debug
        self._mtcnn = None
        self._rec = None
        self._load_models()

    # -- model loading (once) --------------------------------------------
    def _load_models(self) -> None:
        """Load MTCNN detector + ArcFace recognition model a single time."""
        t0 = time.perf_counter()
        self._load_detector()
        self._load_recognizer()
        logger.info(
            "Face models loaded: detector=%s recognition=%s (%.0f ms)",
            self._detector,
            self._model_name,
            (time.perf_counter() - t0) * 1000,
        )

    def _load_detector(self) -> None:
        # -- how to switch detector: add another branch here that sets
        #    self._mtcnn (or an equivalent) and adapt _detect() to read its
        #    output. Everything downstream only needs (box, 5-landmarks, conf).
        if self._detector != "mtcnn":
            raise ValueError(
                f"Unsupported FACE_DETECTOR={self._detector!r}; only 'mtcnn' is implemented"
            )
        from facenet_pytorch import MTCNN  # lazy, heavy

        # keep_all=True so we can *see* extra faces and reject the frame;
        # post_process=False keeps raw pixels (we do our own alignment/crop).
        self._mtcnn = MTCNN(keep_all=True, post_process=False, device="cpu")

    def _load_recognizer(self) -> None:
        """Load ONLY the ArcFace recognition ONNX from the pack (MTCNN detects).

        We deliberately avoid insightface's FaceAnalysis wrapper: its __init__
        asserts a 'detection' model is present, but we only want recognition.
        Instead we ensure the pack is downloaded and load the recognition ONNX
        directly with model_zoo.get_model (taskname == 'recognition').
        """
        import glob
        import os.path as osp

        from insightface.model_zoo import get_model  # lazy, heavy
        from insightface.utils import storage  # lazy

        # Download+unzip the pack to ~/.insightface/models/<name> if missing.
        model_dir = storage.ensure_available("models", self._model_name)
        onnx_files = sorted(
            glob.glob(osp.join(model_dir, "*.onnx")),
            # try the recognition file (w600k_*) first to avoid loading others
            key=lambda p: (0 if "w600k" in osp.basename(p) else 1, p),
        )
        rec = None
        for onnx_path in onnx_files:
            model = get_model(onnx_path, providers=["CPUExecutionProvider"])
            if model is not None and getattr(model, "taskname", None) == "recognition":
                rec = model
                break
        if rec is None:
            raise RuntimeError(f"InsightFace pack {self._model_name!r} has no recognition model")
        rec.prepare(ctx_id=-1)  # -1 = CPU
        self._rec = rec

    # -- preprocessing (requirement 3) -----------------------------------
    def _preprocess(self, image_bytes: bytes, normalize: bool = True):
        """Bytes -> RGB uint8 ndarray, EXIF-rotated, RGB, downscaled, CLAHE'd.

        normalize=False skips the CLAHE lighting step (used for liveness, whose
        variance threshold is tuned on un-equalised pixels).
        """
        import numpy as np  # lazy
        from PIL import Image, ImageOps  # lazy

        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:  # noqa: BLE001 - any decode failure = unreadable
            raise NoFaceDetectedError("Unreadable image") from exc

        img = ImageOps.exif_transpose(img)  # (a) auto-rotate via EXIF
        img = img.convert("RGB")  # (b) force RGB
        w, h = img.size
        longest = max(w, h)
        if longest > self._max_size:  # (c) resize if too large
            scale = self._max_size / float(longest)
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)

        rgb = np.asarray(img, dtype=np.uint8)
        if normalize:
            rgb = self._normalize_lighting(rgb)  # (d) even out lighting
        return rgb

    @staticmethod
    def _normalize_lighting(rgb):
        """CLAHE on the L channel (LAB) — evens out uneven/low light for detection."""
        import cv2  # lazy

        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)

    # -- detection (requirement 1) ---------------------------------------
    def _detect(self, rgb):
        """Detect exactly one face; return (box, landmarks[5x2], confidence).

        Rejects: no face, multiple faces (both above the confidence gate), and
        faces smaller than FACE_MIN_SIZE_PX.
        """
        import numpy as np  # lazy
        from PIL import Image  # lazy

        pil = Image.fromarray(rgb)
        boxes, probs, points = self._mtcnn.detect(pil, landmarks=True)
        if boxes is None or probs is None:
            raise NoFaceDetectedError()

        keep = [i for i, p in enumerate(probs) if p is not None and p >= self._det_min_conf]
        if not keep:
            raise NoFaceDetectedError()
        if len(keep) > 1:
            raise MultipleFacesError()

        i = keep[0]
        box = boxes[i]
        conf = float(probs[i])
        kps = np.asarray(points[i], dtype=np.float32)  # (5, 2)

        side = min(float(box[2] - box[0]), float(box[3] - box[1]))
        if side < self._min_face_px:
            raise FaceTooSmallError()
        return box, kps, conf

    # -- enrolment quality gates (requirement 4) -------------------------
    def _check_blur(self, aligned_bgr) -> None:
        import cv2  # lazy

        gray = cv2.cvtColor(aligned_bgr, cv2.COLOR_BGR2GRAY)
        variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if variance < self._blur_min_var:
            raise BlurryFaceError()

    def _check_side_profile(self, kps) -> None:
        # Landmark order (ArcFace/MTCNN): left_eye, right_eye, nose, l_mouth, r_mouth.
        left_eye, right_eye, nose = kps[0], kps[1], kps[2]
        eye_center_x = (float(left_eye[0]) + float(right_eye[0])) / 2.0
        eye_dist = abs(float(right_eye[0]) - float(left_eye[0])) or 1.0
        ratio = abs(float(nose[0]) - eye_center_x) / eye_dist
        if ratio > self._side_profile_max_ratio:
            raise SideProfileError()

    # -- interface --------------------------------------------------------
    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        import cv2  # lazy
        import numpy as np  # lazy
        from insightface.utils import face_align  # lazy

        t0 = time.perf_counter()
        try:
            rgb = self._preprocess(image_bytes, normalize=True)
            box, kps, det_conf = self._detect(rgb)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            # Align + crop to a 112x112 ArcFace chip using the 5 landmarks.
            aligned = face_align.norm_crop(bgr, landmark=kps, image_size=112)

            if enroll:  # stricter gates only when building the master template
                self._check_blur(aligned)
                self._check_side_profile(kps)

            feat = np.asarray(self._rec.get_feat(aligned)).flatten()
            norm = float(np.linalg.norm(feat))
            vec = (feat / norm) if norm else feat  # L2-normalise -> cosine == dot

            face_px = int(min(float(box[2] - box[0]), float(box[3] - box[1])))
            logger.info(
                "face embed ok: enroll=%s det_conf=%.3f face_px=%d dim=%d time=%.0fms",
                enroll,
                det_conf,
                face_px,
                vec.shape[0],
                (time.perf_counter() - t0) * 1000,
            )
            if enroll and self._save_debug:
                self._save_debug_crop(aligned)
            return [float(x) for x in vec]
        except FaceError as exc:
            logger.warning(
                "face embed rejected: %s (enroll=%s, %.0fms)",
                exc.message,
                enroll,
                (time.perf_counter() - t0) * 1000,
            )
            raise

    def compare(self, a: list[float], b: list[float]) -> float:
        if not a or not b:
            raise NoFaceDetectedError("Missing face embedding")
        return cosine_similarity(a, b)

    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        """Basic liveness: texture gate plus, with a frame burst, micro-movement
        and blink detection.

        Single frame — variance-of-Laplacian focus/texture check (as before): a
        live face has high-frequency detail; low-texture screenshots/prints fail.

        Frame burst (check-in sends 2 extra frames ~400 ms apart):
          * micro-movement — mean |Δ| between consecutive gray frames must sit
            in a natural band: near-zero means a re-presented static image
            (photo pinned in front of the lens, replayed screenshot); a huge
            change means a scene swap between frames.
          * eye blink — intensity change inside the eye-landmark patches well
            above the global motion indicates a blink / non-rigid facial
            movement and passes even a perfectly still subject.

        Still a heuristic (a warped, wobbling print can pass) — production PAD
        needs a dedicated model — but it defeats flat photos and static replays.
        """
        if not self._liveness_enabled:
            return True
        import cv2  # lazy
        import numpy as np  # lazy

        grays = []
        for data in [image_bytes, *(extra_frames or [])]:
            rgb = self._preprocess(data, normalize=False)
            grays.append(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))

        # Texture gate on every frame (catches low-detail screens/prints).
        for gray in grays:
            if float(cv2.Laplacian(gray, cv2.CV_64F).var()) < self._liveness_min_var:
                return False

        if len(grays) < 2:
            return True  # legacy single-frame caller — texture check only

        base = grays[0]
        aligned = [base] + [
            g if g.shape == base.shape else cv2.resize(g, (base.shape[1], base.shape[0]))
            for g in grays[1:]
        ]
        motion = max(
            float(np.mean(cv2.absdiff(aligned[i], aligned[i + 1]))) / 255.0
            for i in range(len(aligned) - 1)
        )

        if motion > self._liveness_max_motion:
            logger.warning("liveness fail: frame change too large (motion=%.4f)", motion)
            return False
        if self._blink_detected(aligned, motion):
            return True
        if motion < self._liveness_min_motion:
            logger.warning("liveness fail: static frames (motion=%.5f)", motion)
            return False
        return True

    def _blink_detected(self, grays, global_motion: float) -> bool:
        """Blink / non-rigid facial movement: the eye-landmark patches changing
        much more than the frame as a whole. A failed detection only disables
        this signal — the motion band still decides."""
        import cv2  # lazy
        import numpy as np  # lazy

        try:
            rgb0 = cv2.cvtColor(grays[0], cv2.COLOR_GRAY2RGB)
            _, kps, _ = self._detect(rgb0)
        except FaceError:
            return False

        eye_dist = float(np.hypot(*(kps[1] - kps[0]))) or 1.0
        r = max(6, int(eye_dist * 0.22))
        h, w = grays[0].shape
        deltas = []
        for ex, ey in (kps[0], kps[1]):  # left_eye, right_eye landmarks
            x0, x1 = max(0, int(ex) - r), min(w, int(ex) + r)
            y0, y1 = max(0, int(ey) - r), min(h, int(ey) + r)
            if x1 <= x0 or y1 <= y0:
                continue
            patches = [g[y0:y1, x0:x1] for g in grays]
            deltas.extend(
                float(np.mean(cv2.absdiff(patches[i], patches[i + 1]))) / 255.0
                for i in range(len(patches) - 1)
            )
        if not deltas:
            return False
        eye_delta = max(deltas)
        blink = eye_delta >= self._liveness_eye_delta and eye_delta >= 2.0 * global_motion
        if blink:
            logger.info(
                "liveness: blink/micro-movement detected (eye_delta=%.4f motion=%.4f)",
                eye_delta,
                global_motion,
            )
        return blink

    # -- debug only -------------------------------------------------------
    def _save_debug_crop(self, aligned_bgr) -> None:
        """Write the aligned crop to generated/face_debug/ (FACE_SAVE_DEBUG_IMAGES)."""
        try:
            import cv2  # lazy

            debug_dir = get_settings().generated_full_path / "face_debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            path = debug_dir / f"face_{int(time.time() * 1000)}.png"
            cv2.imwrite(str(path), aligned_bgr)
            logger.info("face debug crop written: %s", path)
        except Exception:  # noqa: BLE001 - debugging aid must never break enrolment
            logger.exception("failed to write face debug crop")


@lru_cache(maxsize=1)
def get_face_service() -> FaceRecognitionService:
    """Return the configured face engine as a process-wide singleton.

    @lru_cache means the heavy InsightFace/MTCNN models are constructed exactly
    once (requirement 9). app.main warms this up at startup so no request pays
    the load cost. Call `get_face_service.cache_clear()` in tests to rebuild.
    """
    settings = get_settings()
    engine = (settings.FACE_ENGINE or "stub").lower()
    if engine == "stub":
        return StubFaceService()
    if engine == "http":
        # Delegate embedding/liveness to the standalone face-ai microservice.
        # Lazy import: face_client imports from this module (avoid a cycle) and
        # pulls in httpx only when the HTTP engine is actually selected.
        from hr.backend.services.face_client import HttpFaceService

        return HttpFaceService(settings)
    if engine in ("insightface", "production", "arcface"):
        return InsightFaceService(
            model_name=settings.FACE_MODEL,
            detector=settings.FACE_DETECTOR,
            max_image_size=settings.MAX_FACE_IMAGE_SIZE,
            min_face_px=settings.FACE_MIN_SIZE_PX,
            det_min_confidence=settings.FACE_DETECT_MIN_CONFIDENCE,
            blur_min_var=settings.FACE_BLUR_MIN_VAR,
            side_profile_max_ratio=settings.FACE_SIDE_PROFILE_MAX_RATIO,
            liveness_enabled=settings.FACE_ENABLE_LIVENESS,
            liveness_min_var=settings.FACE_LIVENESS_MIN_VAR,
            liveness_min_motion=settings.FACE_LIVENESS_MIN_MOTION,
            liveness_max_motion=settings.FACE_LIVENESS_MAX_MOTION,
            liveness_eye_delta=settings.FACE_LIVENESS_EYE_DELTA,
            save_debug=settings.FACE_SAVE_DEBUG_IMAGES,
        )
    raise ValueError(f"Unknown FACE_ENGINE: {settings.FACE_ENGINE!r}")

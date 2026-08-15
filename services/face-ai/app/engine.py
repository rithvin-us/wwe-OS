"""
Face engine — MTCNN detection + InsightFace ArcFace (buffalo_l by default) embeddings.

Self-contained copy of the recognition pipeline (ported from the HR backend's
`app.services.face_recognition`), so this microservice shares NO code with the
backend and can be deployed on its own box. It exposes exactly two operations:

    embed(image_bytes, enroll)  -> face template (list[float])
    verify_liveness(image_bytes) -> bool

Matching (cosine, 1:N) is intentionally NOT here — the backend owns the gallery
and does the compare locally, so enrolled templates never leave the database.

Heavy deps (numpy, cv2, PIL, facenet-pytorch, insightface) are imported lazily
so the module (and the stub engine) load fine when they are not installed.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os.path as osp
import time
from abc import ABC, abstractmethod

logger = logging.getLogger("face-ai.engine")


# ── Error hierarchy ──────────────────────────────────────────────────────────
# Each face-quality failure carries a user-safe `.message` and maps to HTTP 422
# in the API layer, so callers get a clear reason (no face / multiple / blurry /
# too small / side profile) rather than a 500.
class FaceError(Exception):
    status_code = 422
    default_message = "Face could not be processed"

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class NoFaceDetectedError(FaceError):
    default_message = "No face detected. Position your face clearly in the frame."


class MultipleFacesError(FaceError):
    default_message = "Multiple faces detected. Only one person may be in frame."


class FaceTooSmallError(FaceError):
    default_message = "Face too small. Move closer to the camera."


class BlurryFaceError(FaceError):
    default_message = "Face too blurry. Hold still and use a sharp, well-lit photo."


class SideProfileError(FaceError):
    default_message = "Face not frontal. Look straight at the camera."


class FaceEngine(ABC):
    """Strategy interface for embedding + liveness."""

    #: True once heavy models are resident (used by /health).
    ready: bool = False

    @abstractmethod
    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        """Embedding for one face. `enroll=True` applies strict quality gates."""

    @abstractmethod
    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        """True if the capture looks like a live face, not a flat spoof.

        `extra_frames` is an optional burst captured ~400 ms apart, used for
        micro-movement / blink analysis when the engine supports it.
        """

    @property
    def embedding_dim(self) -> int:  # overridden where known
        return 0


class StubEngine(FaceEngine):
    """No real model — deterministic pseudo-embedding from the image bytes.

    The SAME image yields the SAME vector (so the backend's cosine scores ~1.0),
    a different image scores ~0. Exercises the whole pipeline with zero heavy
    deps. NOT a real matcher. Liveness always passes.
    """

    ready = True

    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        if not image_bytes:
            raise NoFaceDetectedError()
        digest = hashlib.sha256(image_bytes).digest()
        return [(b - 127.5) / 127.5 for b in digest[:16]]

    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        if not image_bytes:
            raise NoFaceDetectedError()
        return True

    @property
    def embedding_dim(self) -> int:
        return 16


class InsightFaceEngine(FaceEngine):
    """Real engine: MTCNN detection + InsightFace ArcFace (buffalo_l by default).

    Models load once in `load()` (called at startup) and are reused for every
    request. All heavy imports are lazy so this class can be *defined* without
    the ML stack installed.
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
        debug_dir: str,
        use_gpu: bool = False,
    ):
        self._model_name = model_name
        self._use_gpu = use_gpu
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
        self._debug_dir = debug_dir
        self._mtcnn = None
        self._rec = None
        self._dim = 512  # ArcFace embedding size (buffalo_*)

    # -- model loading (once) --------------------------------------------
    def load(self) -> None:
        t0 = time.perf_counter()
        from insightface.app import FaceAnalysis  # lazy, heavy

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if self._use_gpu
            else ["CPUExecutionProvider"]
        )
        app = FaceAnalysis(
            name=self._model_name,
            allowed_modules=["detection", "recognition"],
            providers=providers,
        )
        ctx_id = 0 if self._use_gpu else -1
        app.prepare(ctx_id=ctx_id, det_size=(1024, 1024))
        self._app = app
        self.ready = True
        logger.info(
            "Face models loaded: native InsightFace FaceAnalysis pack=%s det_size=(1024, 1024) (%.0f ms)",
            self._model_name,
            (time.perf_counter() - t0) * 1000,
        )

    # -- preprocessing ----------------------------------------------------
    def _preprocess(self, image_bytes: bytes, normalize: bool = True):
        import numpy as np  # lazy
        from PIL import Image, ImageOps  # lazy

        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:  # noqa: BLE001 - any decode failure = unreadable
            raise NoFaceDetectedError("Unreadable image") from exc

        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        w, h = img.size
        longest = max(w, h)
        if longest > self._max_size:
            scale = self._max_size / float(longest)
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)

        rgb = np.asarray(img, dtype=np.uint8)
        if normalize:
            rgb = self._normalize_lighting(rgb)
        return rgb

    @staticmethod
    def _normalize_lighting(rgb):
        """Adaptive CLAHE on L channel only when lighting is underexposed or harsh."""
        import cv2  # lazy

        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        mean_l = float(l.mean())
        # Only apply CLAHE if image is dark (<60) or harsh contrast (>200)
        if mean_l < 60.0 or mean_l > 200.0:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)
        return rgb

    # -- enrolment quality gates -----------------------------------------
    def _check_blur(self, bgr) -> None:
        import cv2  # lazy

        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if variance < self._blur_min_var:
            raise BlurryFaceError()

    def _check_side_profile(self, kps) -> None:
        if kps is None or len(kps) < 3:
            return
        left_eye, right_eye, nose = kps[0], kps[1], kps[2]
        eye_center_x = (float(left_eye[0]) + float(right_eye[0])) / 2.0
        eye_dist = abs(float(right_eye[0]) - float(left_eye[0])) or 1.0
        ratio = abs(float(nose[0]) - eye_center_x) / eye_dist
        if ratio > self._side_profile_max_ratio:
            raise SideProfileError()

    # -- interface --------------------------------------------------------
    def embed(self, image_bytes: bytes, enroll: bool = False) -> list[float]:
        import numpy as np  # lazy
        import cv2  # lazy
        from insightface.utils import face_align  # lazy

        t0 = time.perf_counter()
        try:
            if getattr(self, "_app", None) is None:
                self.load()
            rgb = self._preprocess(image_bytes, normalize=True)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            faces = self._app.get(bgr)

            if not faces:
                raise NoFaceDetectedError()
            if len(faces) > 1:
                if enroll:
                    raise MultipleFacesError()
                # Sort detected faces by bounding box area (width * height) and pick the primary/largest face in frame
                faces = sorted(
                    faces,
                    key=lambda f: float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])),
                    reverse=True,
                )

            face = faces[0]
            det_conf = float(face.det_score) if hasattr(face, "det_score") else 1.0
            if det_conf < self._det_min_conf:
                raise NoFaceDetectedError()

            box = face.bbox  # [x1, y1, x2, y2]
            side = min(float(box[2] - box[0]), float(box[3] - box[1]))
            if side < self._min_face_px:
                raise FaceTooSmallError()

            if enroll:
                self._check_blur(bgr)
                if hasattr(face, "kps"):
                    self._check_side_profile(face.kps)

            # Test-Time Augmentation (TTA): Ensemble original + horizontally flipped crops
            feat_orig = np.asarray(face.embedding).flatten()
            if hasattr(face, "kps") and "recognition" in getattr(self._app, "models", {}):
                try:
                    aligned = face_align.norm_crop(bgr, landmark=face.kps, image_size=112)
                    aligned_flip = cv2.flip(aligned, 1)
                    feat_flip = np.asarray(
                        self._app.models["recognition"].get_feat(aligned_flip)
                    ).flatten()
                    feat = feat_orig + feat_flip
                except Exception:  # noqa: BLE001 - fallback to single embedding
                    feat = feat_orig
            else:
                feat = feat_orig

            norm = float(np.linalg.norm(feat))
            vec = (feat / norm) if norm else feat  # L2-normalise -> cosine == dot
            self._dim = int(vec.shape[0])

            logger.info(
                "embed ok: enroll=%s det_conf=%.3f face_px=%d dim=%d time=%.0fms (TTA ensemble)",
                enroll,
                det_conf,
                int(side),
                vec.shape[0],
                (time.perf_counter() - t0) * 1000,
            )
            return [float(x) for x in vec]
        except FaceError as exc:
            logger.warning(
                "embed rejected: %s (enroll=%s, %.0fms)",
                exc.message,
                enroll,
                (time.perf_counter() - t0) * 1000,
            )
            raise

    def verify_liveness(self, image_bytes: bytes, extra_frames: list[bytes] | None = None) -> bool:
        """Basic liveness: texture gate plus, with a frame burst, micro-movement
        and blink detection (mirrors backend app.services.face_recognition).

        Single frame — variance-of-Laplacian focus/texture check.
        Frame burst — consecutive-frame mean |Δ| must sit in a natural band
        (near-zero = static photo/replay, huge = scene swap); an eye-patch
        change well above global motion counts as a blink and passes a
        perfectly still subject. Heuristic, not production PAD.
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
            return True  # single-frame caller — texture check only

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

    @property
    def embedding_dim(self) -> int:
        return self._dim

    # -- debug only -------------------------------------------------------
    def _save_debug_crop(self, aligned_bgr) -> None:
        try:
            import os
            import cv2  # lazy

            os.makedirs(self._debug_dir, exist_ok=True)
            path = osp.join(self._debug_dir, f"face_{int(time.time() * 1000)}.png")
            cv2.imwrite(path, aligned_bgr)
            logger.info("debug crop written: %s", path)
        except Exception:  # noqa: BLE001 - debugging aid must never break enrolment
            logger.exception("failed to write debug crop")


def build_engine(settings) -> FaceEngine:
    """Factory: construct the engine named by settings.FACE_ENGINE (not loaded)."""
    engine = (settings.FACE_ENGINE or "stub").lower()
    if engine == "stub":
        return StubEngine()
    if engine in ("insightface", "production", "arcface"):
        return InsightFaceEngine(
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
            debug_dir=settings.DEBUG_IMAGE_DIR,
            use_gpu=getattr(settings, "FACE_USE_GPU", False),
        )
    raise ValueError(f"Unknown FACE_ENGINE: {settings.FACE_ENGINE!r}")

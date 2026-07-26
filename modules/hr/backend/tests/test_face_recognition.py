"""
Unit tests for app.services.face_recognition — the pluggable face engine, its
stub, the cosine/confidence helpers, the FaceError hierarchy and the factory.

These tests are ML-free: they exercise the stub engine and the pure helpers, so
the suite stays green on a lightweight install WITHOUT torch / insightface /
opencv. The heavy InsightFaceService is smoke-tested only when its deps are
importable (skipped otherwise).
"""

import pytest

from hr.backend.services.face_recognition import (
    BlurryFaceError,
    FaceError,
    FaceRecognitionService,
    FaceTooSmallError,
    MultipleFacesError,
    NoFaceDetectedError,
    SideProfileError,
    StubFaceService,
    cosine_similarity,
    get_face_service,
    to_confidence,
)


class TestStubFaceService:
    def test_embed_is_deterministic(self):
        svc = StubFaceService()
        assert svc.embed(b"same-image") == svc.embed(b"same-image")

    def test_embed_differs_by_input(self):
        svc = StubFaceService()
        assert svc.embed(b"image-a") != svc.embed(b"image-b")

    def test_embed_accepts_enroll_flag(self):
        # enroll=True must not change the stub's output (no real quality model).
        svc = StubFaceService()
        assert svc.embed(b"x", enroll=True) == svc.embed(b"x", enroll=False)

    def test_embed_empty_raises_no_face(self):
        with pytest.raises(NoFaceDetectedError):
            StubFaceService().embed(b"")

    def test_compare_same_image_is_one(self):
        svc = StubFaceService()
        emb = svc.embed(b"a")
        assert svc.compare(emb, emb) == pytest.approx(1.0)

    def test_compare_different_images_below_match(self):
        # Different images are near-orthogonal, well under the 0.45 threshold.
        svc = StubFaceService()
        score = svc.compare(svc.embed(b"image-a"), svc.embed(b"image-b"))
        assert score < 0.45

    def test_liveness_always_true(self):
        assert StubFaceService().verify_liveness(b"anything") is True


class TestCosineSimilarity:
    def test_identical_vectors(self):
        assert cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)

    def test_empty_or_mismatched_is_zero(self):
        assert cosine_similarity([], [1.0]) == 0.0
        assert cosine_similarity([1.0, 2.0], [1.0]) == 0.0


class TestConfidence:
    def test_perfect_match_is_100(self):
        assert to_confidence(1.0) == 100.0

    def test_negative_is_zero(self):
        assert to_confidence(-0.3) == 0.0

    def test_mid_score(self):
        assert to_confidence(0.45) == 45.0


class TestFaceErrors:
    def test_all_subclass_faceerror(self):
        for cls in (
            NoFaceDetectedError,
            MultipleFacesError,
            FaceTooSmallError,
            BlurryFaceError,
            SideProfileError,
        ):
            assert issubclass(cls, FaceError)

    def test_default_message_and_status(self):
        err = MultipleFacesError()
        assert err.status_code == 422
        assert "one" in err.message.lower()

    def test_custom_message(self):
        assert NoFaceDetectedError("boom").message == "boom"


class TestSerialization:
    def test_roundtrip(self):
        vec = [0.1, 0.2, 0.3]
        blob = FaceRecognitionService.serialize(vec)
        assert FaceRecognitionService.deserialize(blob) == vec

    def test_deserialize_none_is_none(self):
        assert FaceRecognitionService.deserialize(None) is None


class TestFactory:
    def test_default_engine_is_stub(self):
        get_face_service.cache_clear()
        assert isinstance(get_face_service(), StubFaceService)

    def test_is_cached_singleton(self):
        get_face_service.cache_clear()
        assert get_face_service() is get_face_service()


class TestInsightFaceServiceOptional:
    """Smoke test the real engine only when its heavy deps are importable."""

    def test_construct_and_embed_if_available(self):
        pytest.importorskip("cv2")
        pytest.importorskip("numpy")
        pytest.importorskip("insightface")
        pytest.importorskip("facenet_pytorch")
        import cv2
        import numpy as np

        from hr.backend.services.face_recognition import InsightFaceService

        svc = InsightFaceService(
            model_name="buffalo_s",
            detector="mtcnn",
            max_image_size=1024,
            min_face_px=20,
            det_min_confidence=0.90,
            blur_min_var=10.0,
            side_profile_max_ratio=0.35,
            liveness_enabled=False,
            liveness_min_var=60.0,
            save_debug=False,
        )
        # A flat grey image has no face -> NoFaceDetectedError, proving the
        # detect path is wired without needing a real face fixture in the repo.
        flat = np.full((300, 300, 3), 127, dtype=np.uint8)
        ok, buf = cv2.imencode(".png", flat)
        assert ok
        with pytest.raises(NoFaceDetectedError):
            svc.embed(buf.tobytes())

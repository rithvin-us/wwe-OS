"""Cross-pipeline face-matching integration guards.

The AI service (services/face-ai) turns an image into an embedding; the backend
stores one embedding per employee at enrol and runs the 1:N cosine match at
check-in. Matching only works when the ENROLLED templates and the VERIFY probe
come from the SAME embedding pipeline (same model -> same dimension -> same
vector space).

These tests pin the two ways that invariant breaks after the AI service is
integrated, so a regression (or a bad deploy config) is caught here rather than
as silent "Face not recognized" for every employee in production. They use the
real backend matching code and need no DB or ML dependencies.
"""

from __future__ import annotations

from hr.backend.services.attendance_punch import identify_employee
from hr.backend.services.face_recognition import StubFaceService, cosine_similarity

THRESHOLD = 0.36  # HR_FACE_MATCH_THRESHOLD default
MARGIN = 0.05  # HR_FACE_IDENTIFY_MARGIN default


def _gallery(images):
    """(employee_key, embedding) pairs enrolled via the stub engine."""
    stub = StubFaceService()
    return [(f"E{i:03d}", stub.embed(img)) for i, img in enumerate(images, start=1)]


class TestConsistentPipeline:
    """Same engine for enrol and verify -> the right person is identified."""

    def test_same_image_same_engine_matches(self):
        stub = StubFaceService()
        images = [b"person-one-photo", b"person-two-photo", b"person-three-photo"]
        gallery = _gallery(images)
        probe = stub.embed(images[1])  # person two's selfie, same pipeline

        match = identify_employee(probe, gallery, cosine_similarity, THRESHOLD, MARGIN)

        assert match is not None
        assert match[0] == "E002"
        assert match[1] >= THRESHOLD


class TestDimensionMismatch:
    """The #1 silent failure: enrolled and probe embeddings differ in length."""

    def test_unequal_dims_score_zero(self):
        # cosine over unequal-length vectors is defined as 0.0 (never a match).
        assert cosine_similarity([0.1] * 512, [0.1] * 16) == 0.0

    def test_512dim_gallery_vs_16dim_probe_never_matches(self):
        # Gallery enrolled by real ArcFace (512-dim); probe produced by the stub
        # fallback (16-dim) after a face-ai outage / engine switch.
        gallery = [(f"E{i:03d}", [0.05] * 512) for i in range(1, 4)]
        probe = StubFaceService().embed(b"a-real-selfie")  # 16-dim

        assert all(cosine_similarity(probe, emb) == 0.0 for _, emb in gallery)
        match = identify_employee(probe, gallery, cosine_similarity, THRESHOLD, MARGIN)
        assert match is None  # every candidate scores 0.0 -> "Face not recognized"


class TestVectorSpaceMismatch:
    """Same dimension, different model/alignment -> score collapses below the gate."""

    def test_offspace_probe_falls_below_threshold(self):
        stub = StubFaceService()
        images = [b"person-one", b"person-two", b"person-three"]
        gallery = _gallery(images)

        # A probe from a *different* vector space (e.g. face-ai SCRFD alignment
        # vs the in-process MTCNN alignment, or buffalo_s vs buffalo_l): right
        # length, wrong direction. Model it as an unrelated same-length vector.
        offspace_probe = stub.embed(b"person-two")
        offspace_probe = [v * 0.15 + 0.8 for v in offspace_probe]  # heavy drift

        best = max(cosine_similarity(offspace_probe, emb) for _, emb in gallery)
        assert best < THRESHOLD

        match = identify_employee(offspace_probe, gallery, cosine_similarity, THRESHOLD, MARGIN)
        assert match is None


class TestAmbiguousMatchRejected:
    """Two near-identical enrolled faces must not be attributed arbitrarily."""

    def test_within_margin_is_rejected(self):
        probe = [1.0, 0.0, 0.0]
        # Two candidates that both score high and sit within MARGIN of each other.
        gallery = [("A", [0.99, 0.14, 0.0]), ("B", [0.98, 0.20, 0.0])]
        a = cosine_similarity(probe, gallery[0][1])
        b = cosine_similarity(probe, gallery[1][1])
        assert a >= THRESHOLD and b >= THRESHOLD
        assert abs(a - b) < MARGIN

        assert identify_employee(probe, gallery, cosine_similarity, THRESHOLD, MARGIN) is None

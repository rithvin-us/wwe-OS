"""
Unit tests for app.services.attendance_punch — the pure decision helpers for
self-service check-in (decision, in/out direction, swipe-time updates).
"""

from hr.backend.services.attendance_punch import (
    AUTO_APPROVED,
    FLAGGED,
    decide_punch,
    identify_employee,
    next_swipe_times,
    punch_direction,
)

THRESHOLD = 0.75
MARGIN = 0.05


class TestDecidePunch:
    def test_approved_when_face_and_geofence_pass(self):
        assert decide_punch(0.9, True, THRESHOLD) == AUTO_APPROVED

    def test_flagged_when_face_below_threshold(self):
        assert decide_punch(0.5, True, THRESHOLD) == FLAGGED
        assert decide_punch(0.5, False, THRESHOLD) == FLAGGED

    def test_flagged_when_outside_geofence(self):
        # Geofence is enforced: a good face score outside the fence is flagged.
        assert decide_punch(0.99, False, THRESHOLD) == FLAGGED

    def test_boundary_score_inside_fence_is_approved(self):
        assert decide_punch(THRESHOLD, True, THRESHOLD) == AUTO_APPROVED


class TestIdentifyEmployee:
    @staticmethod
    def _cos(a, b):
        # tiny cosine over 1-D lists for the test doubles
        from hr.backend.services.face_recognition import cosine_similarity

        return cosine_similarity(a, b)

    def test_returns_none_when_no_candidates(self):
        assert identify_employee([1.0, 0.0], [], self._cos, THRESHOLD, MARGIN) is None

    def test_picks_best_match_over_threshold(self):
        probe = [1.0, 0.0]
        cands = [("alice", [1.0, 0.0]), ("bob", [0.0, 1.0])]
        match = identify_employee(probe, cands, self._cos, THRESHOLD, MARGIN)
        assert match is not None and match[0] == "alice"

    def test_none_when_best_below_threshold(self):
        probe = [1.0, 0.0]
        cands = [("bob", [0.0, 1.0])]  # orthogonal -> cosine 0
        assert identify_employee(probe, cands, self._cos, THRESHOLD, MARGIN) is None

    def test_none_when_ambiguous_within_margin(self):
        # Two near-identical templates: best barely beats 2nd -> rejected.
        probe = [1.0, 0.0]
        cands = [("alice", [1.0, 0.0]), ("clone", [1.0, 0.001])]
        assert identify_employee(probe, cands, self._cos, THRESHOLD, MARGIN) is None

    def test_skips_candidates_without_embedding(self):
        probe = [1.0, 0.0]
        cands = [("noembed", None), ("alice", [1.0, 0.0])]
        match = identify_employee(probe, cands, self._cos, THRESHOLD, MARGIN)
        assert match is not None and match[0] == "alice"


class TestPunchDirection:
    def test_first_punch_is_in(self):
        assert punch_direction(None) == "in"

    def test_second_punch_is_out(self):
        assert punch_direction("09:02") == "out"


class TestNextSwipeTimes:
    def test_in_sets_in_time_preserving_out(self):
        assert next_swipe_times("in", None, None, "09:00") == ("09:00", None)

    def test_out_sets_out_time_preserving_in(self):
        assert next_swipe_times("out", "09:00", None, "17:05") == ("09:00", "17:05")

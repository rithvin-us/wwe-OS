"""
Attendance Punch — pure decision helpers for self-service check-in.

Kept free of I/O so the decision rules are unit-testable without a database or
HTTP layer. The endpoint (app.api.attendance /punch) wires these to face
scoring, the geofence and the attendance repository.

Design: face score and geofence are soft signals. A punch is auto-approved
only when BOTH pass; otherwise it is flagged for HR review (still logged, but
no attendance row is written).
"""

from collections.abc import Callable, Sequence
from typing import TypeVar

AUTO_APPROVED = "auto_approved"
FLAGGED = "flagged"

T = TypeVar("T")


def decide_punch(face_score: float, within_geofence: bool, threshold: float) -> str:
    """Decide a punch outcome from the face score and geofence result.

    Auto-approved only when the face is confidently matched AND the fix is
    inside the site fence; any other case is flagged for HR review.
    """
    if face_score >= threshold and within_geofence:
        return AUTO_APPROVED
    return FLAGGED


def identify_employee(
    probe: list[float],
    candidates: Sequence[tuple[T, list[float] | None]],
    compare: Callable[[list[float], list[float]], float],
    threshold: float,
    margin: float,
) -> tuple[T, float] | None:
    """1:N face identification against enrolled templates.

    `candidates` is a sequence of (employee, embedding) pairs. Returns the
    (employee, score) of the best match, or None when nothing matches. A match
    requires BOTH:
      * best score >= threshold, and
      * best score beats the 2nd-best by at least `margin` (so a face that sits
        ambiguously between two enrolled people is rejected, not mis-attributed).
    """
    scored: list[tuple[T, float]] = []
    for obj, emb in candidates:
        if not emb:
            continue
        scored.append((obj, compare(probe, emb)))
    if not scored:
        return None
    scored.sort(key=lambda pair: pair[1], reverse=True)
    best_obj, best_score = scored[0]
    if best_score < threshold:
        return None
    if len(scored) > 1 and (best_score - scored[1][1]) < margin:
        return None
    return best_obj, best_score


def punch_direction(existing_in_time: str | None) -> str:
    """First punch of the day is an 'in'; any later punch is an 'out'."""
    return "out" if existing_in_time else "in"


def next_swipe_times(
    direction: str,
    existing_in: str | None,
    existing_out: str | None,
    now_hhmm: str,
) -> tuple[str | None, str | None]:
    """Return the (in_time, out_time) to store after applying this punch.

    'in' sets the in_time (preserving any existing out_time); 'out' sets the
    out_time (preserving the recorded in_time).
    """
    if direction == "in":
        return now_hhmm, existing_out
    return existing_in, now_hhmm


def determine_punch_intent(
    punch_hhmm: str,
    default_shift: str,
    open_shift: str | None,
) -> tuple[str, str]:
    """
    Determines the intended shift and punch direction ('in' or 'out') based on a +/- 15 min tolerance.
    """
    from hr.backend.services.shift_rules import MINUTES_PER_DAY, SHIFT_DEFINITIONS, _to_minutes

    punch_min = _to_minutes(punch_hhmm)

    # 1. If there is an open shift, check if this punch is close to its expected OUT.
    if open_shift and open_shift in SHIFT_DEFINITIONS:
        exp_out_min = _to_minutes(SHIFT_DEFINITIONS[open_shift].expected_out)
        dist = abs(punch_min - exp_out_min)
        dist = min(dist, MINUTES_PER_DAY - dist)
        if dist <= 15:
            return open_shift, "out"

    # 2. Check if it's close to ANY shift's IN.
    for code, sdef in SHIFT_DEFINITIONS.items():
        exp_in_min = _to_minutes(sdef.expected_in)
        dist = abs(punch_min - exp_in_min)
        dist = min(dist, MINUTES_PER_DAY - dist)
        if dist <= 15:
            return code, "in"

    # 3. Check if it's close to ANY shift's OUT.
    for code, sdef in SHIFT_DEFINITIONS.items():
        exp_out_min = _to_minutes(sdef.expected_out)
        dist = abs(punch_min - exp_out_min)
        dist = min(dist, MINUTES_PER_DAY - dist)
        if dist <= 15:
            return code, "out"

    # 4. Fallback if outside 15-minute tolerances
    if open_shift:
        return open_shift, "out"
    return default_shift, "in"

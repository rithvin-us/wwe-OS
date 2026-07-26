"""
Shift Rules — Shift Definitions and Swipe Validation

Defines the supported shifts (G/M/E/N) with expected In/Out times and
validates raw swipe times against them: late entry, early exit, OT and
night shifts that cross midnight.

All arithmetic is done on a "shift timeline" anchored at the expected
In time, so a Night shift (22:00 → 06:00) is handled with the same code
path as a day shift — no special-casing of midnight anywhere else.
"""

from dataclasses import dataclass, field

# Grace period applied to late-entry / early-exit checks (minutes).
GRACE_MINUTES = 10

MINUTES_PER_DAY = 24 * 60


@dataclass(frozen=True)
class ShiftDefinition:
    """A supported shift with its expected swipe window."""

    code: str
    name: str
    expected_in: str  # "HH:MM"
    expected_out: str  # "HH:MM"

    @property
    def crosses_midnight(self) -> bool:
        return _to_minutes(self.expected_out) <= _to_minutes(self.expected_in)

    @property
    def duration_hours(self) -> float:
        dur = (_to_minutes(self.expected_out) - _to_minutes(self.expected_in)) % MINUTES_PER_DAY
        return round(dur / 60.0, 2)


SHIFT_DEFINITIONS: dict[str, ShiftDefinition] = {
    "G": ShiftDefinition("G", "General", "09:00", "17:00"),
    "M": ShiftDefinition("M", "Morning", "06:00", "14:00"),
    "E": ShiftDefinition("E", "Evening", "14:00", "22:00"),
    "N": ShiftDefinition("N", "Night", "22:00", "06:00"),
}

DEFAULT_SHIFT = "G"


@dataclass
class ShiftValidation:
    """Result of validating one day's swipe times against a shift."""

    shift: str
    worked_hours: float
    ot_hours: float
    late_entry: bool
    early_exit: bool
    crosses_midnight: bool
    warnings: list[str] = field(default_factory=list)


def _to_minutes(hhmm: str) -> int:
    parts = hhmm.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])


def normalize_shift(code: str | None) -> str:
    """Return a valid shift code, falling back to the default (G)."""
    if code and code.strip().upper() in SHIFT_DEFINITIONS:
        return code.strip().upper()
    return DEFAULT_SHIFT


def infer_shift_from_punch(punch_hhmm: str, default_shift: str) -> str:
    """
    Given a punch-in time ("HH:MM"), infer the shift if the punch occurs
    within ±30 minutes of a shift's expected starting time.
    Otherwise, fall back to the provided default_shift.
    """
    if not punch_hhmm:
        return default_shift

    punch_min = _to_minutes(punch_hhmm)
    closest_shift = default_shift
    min_dist = 9999

    for code, sdef in SHIFT_DEFINITIONS.items():
        expected_min = _to_minutes(sdef.expected_in)
        # Calculate circular distance in minutes (0 to 1440)
        dist = abs(punch_min - expected_min)
        dist = min(dist, MINUTES_PER_DAY - dist)

        if dist <= 30 and dist < min_dist:
            min_dist = dist
            closest_shift = code

    return closest_shift


def validate_swipe(
    shift_code: str | None,
    in_time: str | None,
    out_time: str | None,
    std_hours: float = 8.0,
) -> ShiftValidation:
    """
    Validate a day's raw swipe times against the employee's shift.

    Returns worked hours, daily OT (hours beyond std_hours), and
    late-entry / early-exit flags relative to the shift's expected
    window (with GRACE_MINUTES tolerance).

    Overnight handling: all comparisons happen on a timeline anchored at
    the shift's expected In. Any swipe that lands "before" the anchor is
    shifted +24h, so N-shift swipes like In 22:05 / Out 06:10 next day
    yield 8.08 worked hours, not negative time.
    """
    shift = normalize_shift(shift_code)
    sdef = SHIFT_DEFINITIONS[shift]
    warnings: list[str] = []

    if not in_time or not out_time:
        if in_time and not out_time:
            warnings.append(f"In time {in_time} without Out time — 0 hours")
        elif out_time and not in_time:
            warnings.append(f"Out time {out_time} without In time — 0 hours")
        return ShiftValidation(
            shift=shift,
            worked_hours=0.0,
            ot_hours=0.0,
            late_entry=False,
            early_exit=False,
            crosses_midnight=sdef.crosses_midnight,
            warnings=warnings,
        )

    try:
        in_min = _to_minutes(in_time)
        out_min = _to_minutes(out_time)
    except (ValueError, IndexError):
        warnings.append(f"Invalid time format In={in_time} Out={out_time} — 0 hours")
        return ShiftValidation(
            shift=shift,
            worked_hours=0.0,
            ot_hours=0.0,
            late_entry=False,
            early_exit=False,
            crosses_midnight=sdef.crosses_midnight,
            warnings=warnings,
        )

    exp_in = _to_minutes(sdef.expected_in)
    exp_dur = (_to_minutes(sdef.expected_out) - exp_in) % MINUTES_PER_DAY

    # Anchor the actual swipes on the shift timeline. Offsets are wrapped
    # into [-12h, +12h) around the expected In so an N-shift In of 21:55
    # reads as -5 min (early) rather than +23h55m (late next day).
    in_rel = (in_min - exp_in) % MINUTES_PER_DAY
    if in_rel >= MINUTES_PER_DAY // 2:
        in_rel -= MINUTES_PER_DAY

    # Out is always after In on the timeline; wrap forward from the In swipe.
    out_rel = in_rel + ((out_min - in_min) % MINUTES_PER_DAY)

    worked_minutes = out_rel - in_rel
    worked_hours = round(worked_minutes / 60.0, 2)
    ot_hours = max(0.0, round(worked_hours - std_hours, 2))

    late_entry = in_rel > GRACE_MINUTES
    early_exit = out_rel < exp_dur - GRACE_MINUTES

    if late_entry:
        warnings.append(f"Late entry: In {in_time} vs expected {sdef.expected_in} ({shift})")
    if early_exit:
        warnings.append(f"Early exit: Out {out_time} vs expected {sdef.expected_out} ({shift})")
    if worked_hours > 16:
        warnings.append(
            f"Worked {worked_hours}h from single swipe pair In={in_time} Out={out_time} — verify"
        )

    return ShiftValidation(
        shift=shift,
        worked_hours=worked_hours,
        ot_hours=ot_hours,
        late_entry=late_entry,
        early_exit=early_exit,
        crosses_midnight=sdef.crosses_midnight,
        warnings=warnings,
    )

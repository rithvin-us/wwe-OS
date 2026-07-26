"""
Unit tests for hr.backend.services.shift_rules — shift definitions and swipe
validation, including night shifts that cross midnight.
"""

from hr.backend.services.shift_rules import (
    SHIFT_DEFINITIONS,
    normalize_shift,
    validate_swipe,
)


class TestShiftDefinitions:
    def test_supported_shifts(self):
        assert set(SHIFT_DEFINITIONS) == {"G", "M", "E", "N"}

    def test_only_night_crosses_midnight(self):
        assert SHIFT_DEFINITIONS["N"].crosses_midnight
        for code in ("G", "M", "E"):
            assert not SHIFT_DEFINITIONS[code].crosses_midnight

    def test_durations_are_eight_hours(self):
        for sdef in SHIFT_DEFINITIONS.values():
            assert sdef.duration_hours == 8.0


class TestNormalizeShift:
    def test_valid_codes_pass_through(self):
        assert normalize_shift("n") == "N"
        assert normalize_shift(" e ") == "E"

    def test_invalid_falls_back_to_general(self):
        assert normalize_shift(None) == "G"
        assert normalize_shift("X") == "G"
        assert normalize_shift("") == "G"


class TestValidateSwipe:
    def test_on_time_general_shift(self):
        v = validate_swipe("G", "09:00", "17:00")
        assert v.worked_hours == 8.0
        assert v.ot_hours == 0.0
        assert not v.late_entry
        assert not v.early_exit

    def test_late_entry_beyond_grace(self):
        v = validate_swipe("G", "09:20", "17:00")
        assert v.late_entry
        assert not v.early_exit

    def test_entry_within_grace_not_late(self):
        v = validate_swipe("G", "09:10", "17:00")
        assert not v.late_entry

    def test_early_exit_beyond_grace(self):
        v = validate_swipe("G", "09:00", "16:30")
        assert v.early_exit
        assert v.worked_hours == 7.5

    def test_overtime_computed_daily(self):
        v = validate_swipe("G", "09:00", "19:30")
        assert v.worked_hours == 10.5
        assert v.ot_hours == 2.5

    def test_night_shift_crosses_midnight(self):
        v = validate_swipe("N", "22:00", "06:00")
        assert v.crosses_midnight
        assert v.worked_hours == 8.0
        assert v.ot_hours == 0.0
        assert not v.late_entry
        assert not v.early_exit

    def test_night_shift_ot_past_dawn(self):
        v = validate_swipe("N", "22:00", "08:00")
        assert v.worked_hours == 10.0
        assert v.ot_hours == 2.0

    def test_night_shift_early_arrival_not_late(self):
        # 21:55 must read as 5 minutes early, not 23h55m late.
        v = validate_swipe("N", "21:55", "06:00")
        assert not v.late_entry
        assert v.worked_hours == 8.08

    def test_night_shift_late_entry_after_midnight_window(self):
        v = validate_swipe("N", "22:30", "06:00")
        assert v.late_entry
        assert v.worked_hours == 7.5

    def test_missing_out_time_zero_hours_with_warning(self):
        v = validate_swipe("G", "09:00", None)
        assert v.worked_hours == 0.0
        assert v.ot_hours == 0.0
        assert v.warnings

    def test_invalid_format_zero_hours_with_warning(self):
        v = validate_swipe("G", "9am", "5pm")
        assert v.worked_hours == 0.0
        assert v.warnings

    def test_unknown_shift_uses_general(self):
        v = validate_swipe("Z", "09:00", "17:00")
        assert v.shift == "G"
        assert v.worked_hours == 8.0

    def test_morning_and_evening_windows(self):
        m = validate_swipe("M", "06:00", "14:00")
        e = validate_swipe("E", "14:00", "22:00")
        assert m.worked_hours == 8.0 and not m.late_entry
        assert e.worked_hours == 8.0 and not e.early_exit

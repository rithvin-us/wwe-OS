"""Attendance grid request/response shaping.

Migrated from the legacy Pydantic schemas. The wire shape is preserved so the
grid's save/read round-trip behaves exactly as before: clients may omit the
computed fields on save — the server computes them via shift_rules — and get
them back on read.
"""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import AttendanceStatus


class AttendanceDayEntrySerializer(serializers.Serializer):
    """One day inside the grid: raw swipes plus the per-day computed values."""

    day = serializers.IntegerField(min_value=1, max_value=31)
    # Blank status means "unmark this day" on save — see AttendanceService.
    status = serializers.CharField(default=AttendanceStatus.PRESENT, allow_blank=True)
    shift = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="G/M/E/N; defaults to the employee's shift",
    )
    in_time = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, help_text="HH:MM"
    )
    out_time = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, help_text="HH:MM"
    )
    worked_hours = serializers.FloatField(required=False, allow_null=True)
    ot_hours = serializers.FloatField(required=False, allow_null=True)
    late_entry = serializers.BooleanField(required=False, allow_null=True, read_only=True)
    early_exit = serializers.BooleanField(required=False, allow_null=True, read_only=True)


class AttendanceEmployeeMonthSerializer(serializers.Serializer):
    employee_id = serializers.UUIDField()
    days = AttendanceDayEntrySerializer(many=True)


class AttendanceBulkSaveSerializer(serializers.Serializer):
    """Bulk save of the monthly grid for any number of employees."""

    year = serializers.IntegerField(min_value=2020, max_value=2050)
    month = serializers.IntegerField(min_value=1, max_value=12)
    records = AttendanceEmployeeMonthSerializer(many=True)


class AttendanceGridRowSerializer(serializers.Serializer):
    """One employee's row. `department` and `shift` come from the master."""

    employee_id = serializers.UUIDField()
    employee_code = serializers.CharField()
    employee_name = serializers.CharField()
    department = serializers.CharField(allow_blank=True)
    shift = serializers.CharField()
    days = serializers.DictField(child=AttendanceDayEntrySerializer())


class AttendanceGridSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    rows = AttendanceGridRowSerializer(many=True)

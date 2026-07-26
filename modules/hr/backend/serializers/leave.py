"""Leave request/response shaping."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import LeaveBalance, LeaveRequest, LeaveStatus, LeaveType


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "code", "default_annual_quota", "is_paid", "description"]
        read_only_fields = ["id"]


class LeaveBalanceSerializer(serializers.ModelSerializer):
    """`remaining` is computed, never stored, so it cannot drift from
    allocated/used."""

    employee_name = serializers.CharField(source="employee.employee_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    remaining = serializers.FloatField(read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "leave_type",
            "leave_type_code",
            "leave_type_name",
            "year",
            "allocated",
            "used",
            "remaining",
            "updated_at",
        ]
        read_only_fields = fields


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.employee_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "leave_type",
            "leave_type_name",
            "start_date",
            "end_date",
            "days",
            "reason",
            "status",
            "decided_by_name",
            "decided_at",
            "decision_note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "days",
            "status",
            "decided_by_name",
            "decided_at",
            "decision_note",
            "created_at",
        ]

    def get_decided_by_name(self, obj: LeaveRequest) -> str:
        actor = obj.decided_by
        return (getattr(actor, "username", "") or getattr(actor, "email", "")) if actor else ""


class LeaveRequestCreateSerializer(serializers.Serializer):
    """`days` is never accepted from the client — it is derived from the dates."""

    employee = serializers.UUIDField()
    leave_type = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class LeaveDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[LeaveStatus.APPROVED, LeaveStatus.REJECTED])
    decision_note = serializers.CharField(required=False, allow_blank=True, default="")

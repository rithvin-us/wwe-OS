"""Payroll response shaping."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import Payroll


class PayrollSerializer(serializers.ModelSerializer):
    """Employee identity is read through the relationship, so every row always
    shows the current name from the Employee Master."""

    employee_name = serializers.CharField(read_only=True)
    employee_code = serializers.CharField(read_only=True)

    class Meta:
        model = Payroll
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "year",
            "month",
            "present_days",
            "leave_days",
            "holiday_days",
            "holiday_working_days",
            "week_off_days",
            "total_paid_days",
            "absent_days",
            "ot_hours",
            "basic_earned",
            "da_earned",
            "hra_earned",
            "medical_allowance",
            "conveyance_allowance",
            "nfh_wages",
            "ot_earned",
            "leave_wages",
            "bonus_earned",
            "arrear",
            "gross_salary",
            "pf_deduction",
            "esi_deduction",
            "professional_tax",
            "lwf",
            "advance_deduction",
            "damage_deduction",
            "other_deductions",
            "total_deductions",
            "expense_reimbursement",
            "net_salary",
            "generated_at",
        ]


class PayrollSummarySerializer(serializers.Serializer):
    """A month's payroll plus the totals the payroll screen shows."""

    year = serializers.IntegerField()
    month = serializers.IntegerField()
    total_employees = serializers.IntegerField()
    total_gross = serializers.FloatField()
    total_pf = serializers.FloatField()
    total_esi = serializers.FloatField()
    total_deductions = serializers.FloatField()
    total_net = serializers.FloatField()
    records = PayrollSerializer(many=True)


class PayrollRunSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2020, max_value=2050)
    month = serializers.IntegerField(min_value=1, max_value=12)

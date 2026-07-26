"""Wage-configuration shaping: per-employee salary rules and statutory pay rules."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import Deduction, Holiday, PayRulesConfig, SalaryRule


class SalaryRuleSerializer(serializers.ModelSerializer):
    total_monthly_salary = serializers.FloatField(read_only=True)

    class Meta:
        model = SalaryRule
        fields = [
            "id",
            "employee",
            "wage_type",
            "basic",
            "da",
            "hra",
            "medical_allowance",
            "conveyance_allowance",
            "ot_rate",
            "effective_from",
            "effective_to",
            "total_monthly_salary",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PayRulesConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayRulesConfig
        fields = [
            "id",
            "effective_from",
            "effective_to",
            "standard_days_per_month",
            "standard_hours_per_day",
            "ot_multiplier",
            "pf_employee_percent",
            "pf_employer_percent",
            "pf_cap",
            "esi_employee_percent",
            "esi_employer_percent",
            "esi_wage_ceiling",
            "esi_cap",
            "pt_slabs",
            "lwf_employee",
            "lwf_employer",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name", "type", "year", "created_at"]
        read_only_fields = ["id", "created_at"]


class DeductionSerializer(serializers.ModelSerializer):
    outstanding_amount = serializers.FloatField(read_only=True)

    class Meta:
        model = Deduction
        fields = [
            "id",
            "employee",
            "year",
            "month",
            "type",
            "date_of_payment",
            "amount",
            "installments",
            "recovery_date",
            "recovery_amount",
            "is_recovered",
            "damage_description",
            "showcause_date",
            "act_or_omission",
            "description",
            "outstanding_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

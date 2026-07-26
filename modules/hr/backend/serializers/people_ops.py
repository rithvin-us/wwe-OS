"""Shaping for onboarding checklists, expense claims, analytics and policy chat."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import (
    ClaimStatus,
    EmployeeTask,
    ExpenseClaim,
    TaskTemplate,
    TaxDeclaration,
)


class TaskTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskTemplate
        fields = [
            "id",
            "title",
            "description",
            "department",
            "workflow",
            "default_due_days",
            "sort_order",
            "is_active",
        ]
        read_only_fields = ["id"]


class EmployeeTaskSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.employee_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeTask
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "title",
            "description",
            "department",
            "workflow",
            "status",
            "due_date",
            "completed_at",
            "completed_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_completed_by_name(self, obj: EmployeeTask) -> str:
        actor = obj.completed_by
        return (getattr(actor, "username", "") or getattr(actor, "email", "")) if actor else ""


class ExpenseClaimSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.employee_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    has_receipt = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseClaim
        fields = [
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "expense_date",
            "amount",
            "category",
            "description",
            "has_receipt",
            "status",
            "decided_by_name",
            "decided_at",
            "decision_note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "decided_by_name",
            "decided_at",
            "decision_note",
            "created_at",
        ]

    def get_has_receipt(self, obj: ExpenseClaim) -> bool:
        return obj.receipt_id is not None

    def get_decided_by_name(self, obj: ExpenseClaim) -> str:
        actor = obj.decided_by
        return (getattr(actor, "username", "") or getattr(actor, "email", "")) if actor else ""


class ExpenseClaimCreateSerializer(serializers.Serializer):
    employee = serializers.UUIDField()
    expense_date = serializers.DateField()
    amount = serializers.FloatField(min_value=0.01)
    category = serializers.CharField(required=False, allow_blank=True, default="Other")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    receipt = serializers.FileField(required=False, allow_null=True)


class ExpenseDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[ClaimStatus.APPROVED, ClaimStatus.REJECTED])
    decision_note = serializers.CharField(required=False, allow_blank=True, default="")


class TaxDeclarationSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.employee_name", read_only=True)

    class Meta:
        model = TaxDeclaration
        fields = [
            "id",
            "employee",
            "employee_name",
            "financial_year",
            "section",
            "description",
            "declared_amount",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PolicyChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField()


class PolicyChatResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    sources = serializers.ListField(child=serializers.CharField())

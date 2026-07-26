"""Employee request/response shaping."""

from __future__ import annotations

from rest_framework import serializers

from hr.backend.models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    """Read shape. Age and the Form XXVI age/gender string are derived, never
    stored, so they can never go stale."""

    is_active = serializers.BooleanField(read_only=True)
    age = serializers.IntegerField(read_only=True, allow_null=True)
    age_gender_display = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "employee_name",
            "father_husband_name",
            "gender",
            "dob",
            "address",
            "phone",
            "designation",
            "department",
            "date_of_joining",
            "date_of_leaving",
            "salary",
            "pf_number",
            "uan",
            "esic_number",
            "bank_name",
            "bank_account",
            "ifsc_code",
            "status",
            "skill_category",
            "location",
            "shift",
            "enrolled_at",
            "is_active",
            "age",
            "age_gender_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "enrolled_at", "created_at", "updated_at"]
        # face_embedding is deliberately never exposed: it is biometric data.


class EmployeeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            "employee_code",
            "employee_name",
            "father_husband_name",
            "gender",
            "dob",
            "address",
            "phone",
            "designation",
            "department",
            "date_of_joining",
            "salary",
            "pf_number",
            "uan",
            "esic_number",
            "bank_name",
            "bank_account",
            "ifsc_code",
            "skill_category",
            "location",
            "shift",
        ]


class OffboardEmployeeSerializer(serializers.Serializer):
    """Offboarding takes a leaving date; the employee row itself is kept."""

    date_of_leaving = serializers.DateField()

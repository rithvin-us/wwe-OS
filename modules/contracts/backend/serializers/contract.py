"""Contract API serializers."""

from __future__ import annotations

from contracts.backend.models import Contract, ContractCategory
from rest_framework import serializers


class ContractSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    owner_email = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    days_to_expiry = serializers.IntegerField(read_only=True)
    is_expiring_soon = serializers.BooleanField(read_only=True)

    class Meta:
        model = Contract
        fields = (
            "id",
            "title",
            "counterparty",
            "category",
            "category_label",
            "status",
            "status_label",
            "value",
            "currency",
            "start_date",
            "end_date",
            "auto_renew",
            "renewal_notice_days",
            "notes",
            "ai_summary",
            "summary_status",
            "file_name",
            "owner_email",
            "days_to_expiry",
            "is_expiring_soon",
            "terminated_at",
            "termination_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_owner_email(self, obj: Contract) -> str | None:
        return obj.owner.email if obj.owner else None

    def get_file_name(self, obj: Contract) -> str | None:
        return obj.file.filename if obj.file else None


class _ContractWriteBase(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    counterparty = serializers.CharField(max_length=200)
    category = serializers.ChoiceField(
        choices=ContractCategory.choices, default=ContractCategory.OTHER
    )
    value = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    currency = serializers.CharField(max_length=3, min_length=3, required=False, default="USD")
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    auto_renew = serializers.BooleanField(required=False, default=False)
    renewal_notice_days = serializers.IntegerField(
        required=False, default=30, min_value=0, max_value=365
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="", max_length=5000)

    def validate_currency(self, value: str) -> str:
        return value.upper()

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": ["End date is before the start date."]})
        return attrs


class CreateContractSerializer(_ContractWriteBase):
    pass


class UpdateContractSerializer(_ContractWriteBase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False


class AttachFileSerializer(serializers.Serializer):
    file = serializers.FileField()


class TerminateContractSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=300)


class ExportContractsSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["csv", "xlsx", "pdf", "html"], default="csv")

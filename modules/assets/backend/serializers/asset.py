"""Asset API serializers."""

from __future__ import annotations

from assets.backend.models import Asset, AssetCategory, MaintenanceRecord
from rest_framework import serializers


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceRecord
        fields = (
            "id",
            "performed_on",
            "description",
            "cost",
            "currency",
            "vendor",
            "actor_email",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_email(self, obj: MaintenanceRecord) -> str | None:
        return obj.actor.email if obj.actor else None


class AssetSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "id",
            "name",
            "asset_tag",
            "category",
            "category_label",
            "status",
            "status_label",
            "serial_number",
            "purchase_date",
            "purchase_cost",
            "currency",
            "supplier",
            "location",
            "assigned_to",
            "assigned_at",
            "file_name",
            "disposed_at",
            "disposal_reason",
            "disposal_proceeds",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_file_name(self, obj: Asset) -> str | None:
        return obj.file.filename if obj.file else None


class _AssetWriteBase(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    asset_tag = serializers.CharField(max_length=60)
    category = serializers.ChoiceField(choices=AssetCategory.choices, default=AssetCategory.OTHER)
    serial_number = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    purchase_date = serializers.DateField(required=False, allow_null=True)
    purchase_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    currency = serializers.CharField(max_length=3, min_length=3, required=False, default="USD")
    supplier = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    location = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)

    def validate_currency(self, value: str) -> str:
        return value.upper()


class CreateAssetSerializer(_AssetWriteBase):
    pass


class UpdateAssetSerializer(_AssetWriteBase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False


class AssignSerializer(serializers.Serializer):
    assigned_to = serializers.CharField(max_length=200)


class MaintenanceSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=300)
    cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    currency = serializers.CharField(max_length=3, required=False, default="USD")
    vendor = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    performed_on = serializers.DateField(required=False, allow_null=True)


class DisposeSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=300)
    proceeds = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )


class AttachFileSerializer(serializers.Serializer):
    file = serializers.FileField()


class ExportAssetsSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["csv", "xlsx", "pdf", "html"], default="csv")

from __future__ import annotations

from datetime import date

from rest_framework import serializers

from purchase.backend.models import PurchaseBill, Vendor


class IngestBillSerializer(serializers.Serializer):
    """What an ingestion channel (Telegram bot today) posts. Field names and
    shape match docs/modules/purchase-integration-requirements.md exactly."""

    seller_name = serializers.CharField(max_length=200, allow_blank=False)
    purchase_date = serializers.DateField()
    total_rate = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    currency = serializers.CharField(max_length=3, min_length=3)
    telegram_user_id = serializers.IntegerField(required=False, allow_null=True)
    document_url = serializers.URLField(max_length=500)

    def validate_currency(self, value: str) -> str:
        return value.upper()

    def validate_purchase_date(self, value: date) -> date:
        if value > date.today():
            raise serializers.ValidationError("Purchase date cannot be in the future.")
        return value


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ("id", "name", "is_active", "gst_number")
        read_only_fields = ("id",)
        extra_kwargs = {"name": {"allow_blank": False}}


class PurchaseBillSerializer(serializers.ModelSerializer):
    vendor = VendorSerializer(read_only=True)

    class Meta:
        model = PurchaseBill
        fields = (
            "id",
            "vendor",
            "seller_name",
            "purchase_date",
            "total_rate",
            "currency",
            "document_url",
            "source_channel",
            "status",
            "reviewed_by",
            "reviewed_at",
            "rejection_reason",
            "payment_status",
            "paid_at",
            "created_at",
        )
        read_only_fields = fields


class ConfirmBillSerializer(serializers.Serializer):
    vendor_name = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        help_text="Link (or create) a vendor by name. Leave blank to confirm without one.",
    )


class RejectBillSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=300, allow_blank=False)

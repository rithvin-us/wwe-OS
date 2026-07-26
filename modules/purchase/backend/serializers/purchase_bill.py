from __future__ import annotations

from datetime import date

from rest_framework import serializers

from purchase.backend.models import PurchaseBill, Vendor


class IngestBillSerializer(serializers.Serializer):
    """What an ingestion channel (Telegram bot, WhatsApp, email, web upload) posts."""

    seller_name = serializers.CharField(
        max_length=200, required=False, default="Pending OCR Processing"
    )
    purchase_date = serializers.DateField(required=False, default=date.today)
    total_rate = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0.00
    )
    currency = serializers.CharField(max_length=3, min_length=3, required=False, default="INR")
    telegram_user_id = serializers.IntegerField(required=False, allow_null=True)
    telegram_username = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    document_url = serializers.URLField(max_length=500)
    external_ref = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
        default="",
        help_text="Stable source-document id (e.g. Telegram file_unique_id) used for dedupe.",
    )
    gst_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    invoice_number = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    tax_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0.00
    )
    cgst = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0.00
    )
    sgst = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0.00
    )
    igst = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False, default=0.00
    )
    items = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    source_channel = serializers.CharField(max_length=50, required=False, default="telegram")
    caption = serializers.CharField(required=False, allow_blank=True, default="")
    document_base64 = serializers.CharField(required=False, allow_blank=True, default="")
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list
    )

    def validate_currency(self, value: str) -> str:
        return value.upper()

    def validate_document_url(self, value: str) -> str:
        if not value.lower().startswith("https://") and not value.lower().startswith("http://"):
            raise serializers.ValidationError("Document URL must use http or https.")
        return value

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
    tags = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBill
        fields = (
            "id",
            "vendor",
            "seller_name",
            "purchase_date",
            "invoice_number",
            "invoice_date",
            "gst_number",
            "total_rate",
            "currency",
            "items",
            "total_quantity",
            "tax_amount",
            "payment_method",
            "confidence_score",
            "document_url",
            "storage_key",
            "source_channel",
            "telegram_user_id",
            "telegram_username",
            "is_duplicate",
            "status",
            "payment_status",
            "paid_at",
            "tags",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_tags(self, obj: PurchaseBill) -> list[dict]:
        try:
            from tagging.services import TagService

            tags_qs = TagService().tags_for_object(
                tenant=obj.tenant,
                module="purchase",
                object_type="PurchaseBill",
                object_id=str(obj.id),
            )
            return [{"id": str(t.id), "name": t.name, "color": t.color} for t in tags_qs]
        except Exception:
            return []


class UpdatePurchaseBillSerializer(serializers.Serializer):
    seller_name = serializers.CharField(max_length=200, required=False)
    vendor_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    invoice_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    purchase_date = serializers.DateField(required=False)
    total_rate = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    currency = serializers.CharField(max_length=3, required=False)
    gst_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    payment_method = serializers.CharField(max_length=50, required=False, allow_blank=True)

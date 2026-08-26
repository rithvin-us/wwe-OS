from __future__ import annotations

from finance.backend.models.invoice import (
    Customer,
    Invoice,
    InvoiceLine,
    InvoiceType,
    LifecycleStage,
)
from rest_framework import serializers


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id",
            "name",
            "address",
            "facility",
            "gstin",
            "state",
            "is_sez",
            "is_active",
            "created_at",
            "updated_at",
        )


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = ("position", "description", "hsn", "quantity", "uom", "rate", "amount")


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", default="", read_only=True)
    download_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    generated_by = serializers.SerializerMethodField()
    lifecycle_stage = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            "id",
            "number",
            "invoice_type",
            "financial_year",
            "sequence_number",
            "invoice_date",
            "customer",
            "customer_name",
            "consignee_name",
            "consignee_address",
            "facility",
            "gstin",
            "is_sez",
            "tax_mode",
            "gst_rate",
            "period_year",
            "period_month",
            "period_text",
            "subtotal",
            "cgst_amount",
            "sgst_amount",
            "igst_amount",
            "round_off",
            "total",
            "amount_in_words",
            "status",
            "payment_status",
            "lifecycle_stage",
            "is_overdue",
            "can_delete",
            "due_date",
            "sent_at",
            "paid_at",
            "cancelled_at",
            "cancellation_reason",
            "revision",
            "local_path",
            "pdf_local_path",
            "lines",
            "download_url",
            "pdf_url",
            "generated_by",
            "created_at",
        )

    def get_download_url(self, obj: Invoice) -> str | None:
        return f"/api/v1/finance/invoices/{obj.id}/download/" if obj.file_id else None

    def get_pdf_url(self, obj: Invoice) -> str | None:
        return f"/api/v1/finance/invoices/{obj.id}/pdf/" if obj.pdf_file_id else None

    def get_generated_by(self, obj: Invoice) -> str | None:
        return obj.generated_by.email if obj.generated_by else None

    def get_lifecycle_stage(self, obj: Invoice) -> str:
        return obj.lifecycle_stage()

    def get_is_overdue(self, obj: Invoice) -> bool:
        return obj.is_overdue()

    def get_can_delete(self, obj: Invoice) -> bool:
        """Whether DELETE would be accepted — the same rule the API enforces,
        published so the UI offers the action only where it exists rather than
        offering it everywhere and reporting a 409 afterwards."""
        return obj.lifecycle_stage() == LifecycleStage.GENERATED


class DueDateSerializer(serializers.Serializer):
    due_date = serializers.DateField()


class InvoiceLineInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=500)
    hsn = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, default=1)
    uom = serializers.CharField(max_length=20, required=False, allow_blank=True, default="Nos")
    rate = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)


class GenerateInvoiceSerializer(serializers.Serializer):
    """Input for both `POST /invoices/` (generate) and `POST /invoices/preview/`
    — the two must accept exactly the same thing so the preview is truthful."""

    invoice_type = serializers.ChoiceField(choices=InvoiceType.choices)
    invoice_date = serializers.DateField()
    customer_id = serializers.UUIDField(required=False, allow_null=True)

    # Overrides — used when billing a one-off party with no master record, or
    # correcting a detail for this bill only.
    consignee_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    consignee_address = serializers.CharField(required=False, allow_blank=True)
    facility = serializers.CharField(max_length=255, required=False, allow_blank=True)
    gstin = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_sez = serializers.BooleanField(required=False, allow_null=True, default=None)
    gst_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True, default=None
    )

    # AMC only — defaults to the month before the invoice date.
    period_year = serializers.IntegerField(required=False, allow_null=True, default=None)
    period_month = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=1, max_value=12
    )

    lines = InvoiceLineInputSerializer(many=True, allow_empty=False)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("customer_id") and not (attrs.get("consignee_name") or "").strip():
            raise serializers.ValidationError(
                {"customer_id": ["Pick a customer, or type a consignee name for a one-off bill."]}
            )
        return attrs


class CancelInvoiceSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)

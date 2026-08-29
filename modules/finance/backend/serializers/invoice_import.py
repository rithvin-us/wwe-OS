from __future__ import annotations

from datetime import date
from typing import Any

from django.db.models import Count
from finance.backend.models import (
    InvoiceImportBatch,
    InvoiceImportItem,
    InvoiceImportItemStatus,
)
from rest_framework import serializers


class InvoiceImportItemSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.number", default=None, read_only=True)
    source_url = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceImportItem
        fields = (
            "id",
            "batch",
            "status",
            "original_filename",
            "confidence_score",
            "proposed_number",
            "proposed_invoice_date",
            "proposed_total",
            "proposed",
            "raw_extraction",
            "error_message",
            "invoice",
            "invoice_number",
            "source_url",
            "created_at",
            "updated_at",
        )

    def get_source_url(self, obj: InvoiceImportItem) -> str:
        return f"/api/v1/finance/invoice-import-items/{obj.id}/scan/"


class InvoiceImportBatchSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    counts = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceImportBatch
        fields = ("id", "label", "status", "created_by", "counts", "created_at", "updated_at")

    def get_created_by(self, obj: InvoiceImportBatch) -> str | None:
        return obj.created_by.email if obj.created_by else None

    def get_counts(self, obj: InvoiceImportBatch) -> dict[str, int]:
        counts = {status.value: 0 for status in InvoiceImportItemStatus}
        for row in obj.items.values("status").annotate(n=Count("id")):
            counts[row["status"]] = row["n"]
        counts["total"] = sum(counts[status.value] for status in InvoiceImportItemStatus)
        return counts


class InvoiceImportBatchDetailSerializer(InvoiceImportBatchSerializer):
    items = InvoiceImportItemSerializer(many=True, read_only=True)

    class Meta(InvoiceImportBatchSerializer.Meta):
        fields = InvoiceImportBatchSerializer.Meta.fields + ("items",)


class ImportDraftSerializer(serializers.Serializer):
    """A partial edit of an item's draft invoice. Everything is optional (the
    grid PATCHes only what changed) and everything comes back JSON-safe, because
    the result is merged straight into `InvoiceImportItem.proposed` (a JSONField)
    — so dates and amounts stay strings here, not `date`/`Decimal` objects."""

    number = serializers.CharField(required=False, allow_blank=True, max_length=60)
    invoice_type = serializers.ChoiceField(choices=("amc", "sales"), required=False)
    invoice_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    consignee_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    consignee_address = serializers.CharField(required=False, allow_blank=True)
    facility = serializers.CharField(required=False, allow_blank=True, max_length=255)
    gstin = serializers.CharField(required=False, allow_blank=True, max_length=20)
    is_sez = serializers.BooleanField(required=False)
    gst_rate = serializers.CharField(required=False, allow_blank=True)
    period_year = serializers.IntegerField(required=False, allow_null=True)
    period_month = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=12
    )
    lines = serializers.ListField(required=False)

    def validate_invoice_date(self, value: str | None) -> str:
        if not value:
            return ""
        try:
            date.fromisoformat(str(value)[:10])
        except (ValueError, TypeError) as exc:
            raise serializers.ValidationError("Use a date like 2026-05-31.") from exc
        return str(value)[:10]

    def validate_gst_rate(self, value: str) -> str:
        if value in ("", None):
            return ""
        text = _num_text(value, "")
        if text == "":
            raise serializers.ValidationError("Enter the GST rate as a number, e.g. 18.")
        return text

    def validate_lines(self, value: list) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        for row in value:
            if not isinstance(row, dict):
                continue
            description = str(row.get("description") or "").strip()
            if not description:
                continue
            normalized.append(
                {
                    "description": description[:500],
                    "hsn": str(row.get("hsn") or "").strip()[:20],
                    "quantity": _num_text(row.get("quantity"), "1"),
                    "uom": (str(row.get("uom") or "Nos").strip() or "Nos")[:20],
                    "rate": _num_text(row.get("rate"), "0"),
                }
            )
        return normalized


def _num_text(value: Any, default: str) -> str:
    """Normalize a possibly-formatted number to a plain decimal string."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).strip().replace(",", "").replace("₹", "").replace("/-", "")
    negative = text.startswith("-")
    digits = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    if not digits or digits == ".":
        return default
    return f"-{digits}" if negative else digits

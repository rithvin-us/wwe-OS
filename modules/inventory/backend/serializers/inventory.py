"""Inventory API serializers."""

from __future__ import annotations

from inventory.backend.models import InventoryItem, StockMovement
from rest_framework import serializers


class InventoryItemSerializer(serializers.ModelSerializer):
    stock_value = serializers.DecimalField(
        max_digits=16, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "name",
            "sku",
            "category",
            "unit",
            "quantity_on_hand",
            "unit_cost",
            "currency",
            "location",
            "supplier",
            "is_active",
            "notes",
            "stock_value",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "quantity_on_hand",
            "stock_value",
            "created_at",
            "updated_at",
        )


class CreateItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    sku = serializers.CharField(max_length=60)
    category = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    unit = serializers.CharField(max_length=20, required=False, default="unit")
    unit_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    currency = serializers.CharField(max_length=3, required=False, default="USD")
    location = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    supplier = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)

    def validate_currency(self, value: str) -> str:
        return value.upper()


class UpdateItemSerializer(CreateItemSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False

    is_active = serializers.BooleanField(required=False)


class StockMovementSerializer(serializers.ModelSerializer):
    movement_label = serializers.CharField(source="get_movement_type_display", read_only=True)
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "movement_type",
            "movement_label",
            "delta",
            "balance_after",
            "reason",
            "reference",
            "actor_email",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_email(self, obj: StockMovement) -> str | None:
        return obj.actor.email if obj.actor else None


class RecordMovementSerializer(serializers.Serializer):
    # movement_type is implied by the endpoint (receive / issue / adjust), so
    # the client sends only the magnitude and optional context.
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    reference = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class ExportInventorySerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["csv", "xlsx", "pdf", "html"], default="csv")

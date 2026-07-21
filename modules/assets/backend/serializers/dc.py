from assets.backend.models.dc import DeliveryChallan, Site
from rest_framework import serializers


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = (
            "id",
            "name",
            "address",
            "contact_person",
            "contact_phone",
            "created_at",
            "updated_at",
        )


class DeliveryChallanSerializer(serializers.ModelSerializer):
    site = SiteSerializer()
    generated_by = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryChallan
        fields = ("id", "dc_number", "dc_type", "site", "generated_by", "pdf_url", "created_at")

    def get_generated_by(self, obj):
        if obj.generated_by:
            return obj.generated_by.email
        return None

    def get_pdf_url(self, obj):
        if obj.file:
            return f"/api/assets/dcs/{obj.id}/download/"
        return None


class GenerateDCSerializer(serializers.Serializer):
    site_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    dc_type = serializers.CharField(required=False, allow_blank=True, default="non_returnable")
    dc_number = serializers.CharField()
    date = serializers.CharField()
    deliver_to = serializers.CharField(required=False, allow_blank=True, default="")
    items = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        help_text="List of items, e.g. [{'id': 'inventory_item_id', 'qty': 5}]",
    )

"""Document API serializers."""

from __future__ import annotations

from documents.backend.models import Document, DocumentCategory
from rest_framework import serializers


class DocumentSerializer(serializers.ModelSerializer):
    file_name = serializers.CharField(source="file.filename", read_only=True)
    file_size = serializers.IntegerField(source="file.size_bytes", read_only=True)
    content_type = serializers.CharField(source="file.content_type", read_only=True)
    owner_email = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "description",
            "category",
            "category_label",
            "status",
            "status_label",
            "tags",
            "ai_summary",
            "summary_status",
            "file_name",
            "file_size",
            "content_type",
            "owner_email",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_owner_email(self, obj: Document) -> str | None:
        return obj.owner.email if obj.owner else None


class UploadDocumentSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(max_length=200)
    category = serializers.ChoiceField(
        choices=DocumentCategory.choices, default=DocumentCategory.OTHER
    )
    description = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=5000
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=40), required=False, default=list
    )
    summarize = serializers.BooleanField(required=False, default=True)


class UpdateDocumentSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    category = serializers.ChoiceField(choices=DocumentCategory.choices, required=False)
    description = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    tags = serializers.ListField(child=serializers.CharField(max_length=40), required=False)


class ExportDocumentsSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["csv", "xlsx", "pdf", "html"], default="csv")

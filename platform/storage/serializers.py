"""Storage API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from storage.models import StoredFile


class StoredFileSerializer(BaseModelSerializer):
    class Meta:
        model = StoredFile
        fields = (
            "id",
            "filename",
            "content_type",
            "size_bytes",
            "sha256",
            "module",
            "category",
            "metadata",
            "scan_status",
            "created_at",
        )
        read_only_fields = fields


class UploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    module = serializers.SlugField(max_length=50)
    category = serializers.SlugField(max_length=50, required=False, allow_blank=True, default="")
    metadata = serializers.JSONField(required=False, default=dict)

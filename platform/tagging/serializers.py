"""Tagging API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from tagging.models import Tag, TagColor


class TagSerializer(BaseModelSerializer):
    # Only present when the queryset was annotated with it (the list view);
    # a SerializerMethodField so create/update responses on a bare Tag
    # instance don't raise for the missing attribute.
    usage_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ("id", "name", "color", "usage_count", "created_at")
        read_only_fields = ("id", "created_at")

    def get_usage_count(self, obj: Tag) -> int | None:
        return getattr(obj, "usage_count", None)


class TagWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    color = serializers.ChoiceField(choices=TagColor.choices, required=False, default=TagColor.BLUE)


class ObjectTagsQuerySerializer(serializers.Serializer):
    module = serializers.CharField(max_length=50)
    object_type = serializers.CharField(max_length=100)
    object_id = serializers.CharField(max_length=64)


class SetObjectTagsSerializer(serializers.Serializer):
    module = serializers.CharField(max_length=50)
    object_type = serializers.CharField(max_length=100)
    object_id = serializers.CharField(max_length=64)
    tag_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list
    )

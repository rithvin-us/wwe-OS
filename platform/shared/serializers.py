"""Serializer base shared across capabilities."""

from __future__ import annotations

from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """Common read-only fields present on every platform model."""

    class Meta:
        abstract = True
        read_only_fields = ("id", "created_at", "updated_at")

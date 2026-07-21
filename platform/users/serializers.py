from __future__ import annotations

from typing import Any

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from users.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "avatar_url",
            "status",
            "is_active",
            "is_email_verified",
            "timezone",
            "language",
            "preferences",
            "tenant",
            "last_login",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "is_email_verified",
            "last_login",
            "created_at",
            "updated_at",
        )


class MeProfileSerializer(serializers.ModelSerializer):
    """What a user may edit about their own profile — never their identity
    (username/email) or account state (status/is_active)."""

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "avatar_url",
            "timezone",
            "language",
            "status",
        )
        read_only_fields = ("id", "username", "email", "status")


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "password",
            "status",
            "timezone",
            "language",
            "tenant",
        )
        read_only_fields = ("id",)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data: dict[str, Any]) -> User:
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

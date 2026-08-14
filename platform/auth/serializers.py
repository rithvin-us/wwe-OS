from __future__ import annotations

from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    # Only meaningful for the very first registration, which sets up the
    # company. Ignored (a no-op) once a company already exists.
    company_name = serializers.CharField(required=False, allow_blank=True, max_length=200)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)


class EmailVerifySerializer(serializers.Serializer):
    token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)


class FaceEnrollRequestSerializer(serializers.Serializer):
    file = serializers.ImageField(help_text="Reference face photo")


class FaceStatusSerializer(serializers.Serializer):
    enrolled = serializers.BooleanField()
    enrolled_at = serializers.DateTimeField(allow_null=True)


class FaceLoginRequestSerializer(serializers.Serializer):
    file = serializers.ImageField(help_text="Live-captured selfie")
    frames = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        help_text="Optional liveness burst: extra frames ~400 ms apart",
    )

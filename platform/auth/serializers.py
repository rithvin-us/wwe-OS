from __future__ import annotations

from rest_framework import serializers

# Upper bound on any submitted password. Passwords are hashed with Argon2,
# which is deliberately CPU-heavy — without a cap, a client could POST a
# multi-megabyte string and turn a single request into a denial-of-service.
# Generous enough for any real passphrase; the minimum length lives in
# AUTH_PASSWORD_VALIDATORS. Opaque tokens are bounded for the same reason.
MAX_PASSWORD_LENGTH = 128
MAX_TOKEN_LENGTH = 512


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, max_length=MAX_PASSWORD_LENGTH)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    # Only meaningful for the very first registration, which sets up the
    # company. Ignored (a no-op) once a company already exists.
    company_name = serializers.CharField(required=False, allow_blank=True, max_length=200)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=MAX_PASSWORD_LENGTH)
    remember_me = serializers.BooleanField(default=False)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=MAX_TOKEN_LENGTH)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=MAX_TOKEN_LENGTH)
    new_password = serializers.CharField(write_only=True, max_length=MAX_PASSWORD_LENGTH)


class EmailVerifySerializer(serializers.Serializer):
    token = serializers.CharField(max_length=MAX_TOKEN_LENGTH)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, max_length=MAX_PASSWORD_LENGTH)
    new_password = serializers.CharField(write_only=True, max_length=MAX_PASSWORD_LENGTH)


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

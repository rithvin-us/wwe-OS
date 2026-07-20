"""Authentication support models: sessions/devices, login attempts, and
single-use tokens for password reset and email verification.

Designed so external identity providers (OAuth, Google, Azure AD, LDAP, SAML)
can attach later: a future `IdentityProvider`/`FederatedIdentity` pair links to
the same User without changing anything here.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from shared.models import BaseModel


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class UserSession(BaseModel):
    """A logged-in device/session, keyed by the refresh token's JTI."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions"
    )
    jti = models.CharField(max_length=255, db_index=True)
    device_label = models.CharField(max_length=200, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    remember_me = models.BooleanField(default=False)
    revoked = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(default=timezone.now)

    class Meta(BaseModel.Meta):
        db_table = "auth_user_session"
        indexes = [models.Index(fields=["user", "revoked"])]


class LoginAttempt(BaseModel):
    """Every authentication attempt — the basis for brute-force detection."""

    email = models.EmailField(db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    successful = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        db_table = "auth_login_attempt"
        indexes = [models.Index(fields=["email", "successful", "created_at"])]


class _SingleUseToken(BaseModel):
    """Base for hashed, expiring, single-use tokens."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        abstract = True

    @classmethod
    def issue(cls, user, ttl_seconds: int) -> tuple[_SingleUseToken, str]:
        raw = secrets.token_urlsafe(32)
        instance = cls.objects.create(
            user=user,
            token_hash=_hash_token(raw),
            expires_at=timezone.now() + timedelta(seconds=ttl_seconds),
        )
        return instance, raw

    @classmethod
    def consume(cls, raw: str):
        instance = cls.objects.filter(
            token_hash=_hash_token(raw), used_at__isnull=True, expires_at__gt=timezone.now()
        ).first()
        if instance is not None:
            instance.used_at = timezone.now()
            instance.save(update_fields=["used_at", "updated_at"])
        return instance


class PasswordResetToken(_SingleUseToken):
    class Meta(BaseModel.Meta):
        db_table = "auth_password_reset_token"


class EmailVerificationToken(_SingleUseToken):
    class Meta(BaseModel.Meta):
        db_table = "auth_email_verification_token"

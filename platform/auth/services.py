"""Authentication service — the enterprise auth flows.

Covers: registration, login with brute-force protection and account locking,
device/session tracking, refresh rotation (via SimpleJWT), logout, logout
everywhere, password reset, email verification, and password change.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.contrib.auth import authenticate as django_authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken
from shared.events import Events, publish
from shared.exceptions import (
    AuthenticationFailedError,
    RateLimitedError,
    ValidationError,
)
from shared.services import BaseService
from tenancy.models import Tenant
from users.models import User

from auth.models import (
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    UserSession,
)


class AuthService(BaseService):
    # ---------------------------------------------------------------- lockout
    def _lockout_key(self, email: str) -> str:
        return f"auth:lockout:{email.lower()}"

    def _is_locked(self, email: str) -> bool:
        return cache.get(self._lockout_key(email), 0) >= settings.AUTH_LOCKOUT_MAX_ATTEMPTS

    def _record_failure(self, email: str) -> None:
        key = self._lockout_key(email)
        try:
            count = cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=settings.AUTH_LOCKOUT_WINDOW_SECONDS)
            count = 1
        if count >= settings.AUTH_LOCKOUT_MAX_ATTEMPTS:
            cache.set(key, count, timeout=settings.AUTH_LOCKOUT_DURATION_SECONDS)

    def _clear_failures(self, email: str) -> None:
        cache.delete(self._lockout_key(email))

    # ------------------------------------------------------------------ tokens
    def issue_tokens(
        self, user: User, *, remember_me: bool, ip: str | None, user_agent: str
    ) -> dict[str, Any]:
        refresh = RefreshToken.for_user(user)
        if remember_me:
            refresh.set_exp(lifetime=settings.SIMPLE_JWT["REFRESH_TOKEN_REMEMBER_ME_LIFETIME"])
        UserSession.objects.create(
            user=user,
            jti=str(refresh["jti"]),
            ip_address=ip,
            user_agent=(user_agent or "")[:512],
            remember_me=remember_me,
            device_label=self._device_label(user_agent),
        )
        return {"access": str(refresh.access_token), "refresh": str(refresh)}

    @staticmethod
    def _device_label(user_agent: str) -> str:
        ua = (user_agent or "").lower()
        if "mobile" in ua or "android" in ua or "iphone" in ua:
            return "Mobile device"
        if "windows" in ua:
            return "Windows"
        if "mac" in ua:
            return "macOS"
        if "linux" in ua:
            return "Linux"
        return "Unknown device"

    # ---------------------------------------------------------------- register
    def register(
        self,
        *,
        email: str,
        username: str,
        password: str,
        tenant=None,
        company_name: str = "",
        **extra: Any,
    ) -> User:
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError(detail={"email": ["This email is already registered."]})
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError(detail={"username": ["This username is taken."]})
        validate_password(password)

        # Single-operator bootstrap: the first person to ever register sets
        # up the company and becomes its Owner. Anyone registering after
        # that joins the existing company as a Member. See
        # platform/tenancy/services.py — this is the only place allowed to
        # create a Tenant implicitly.
        from tenancy.services import TenancyService

        is_first_user = tenant is None and Tenant.objects.count() == 0
        if tenant is None:
            tenant = TenancyService().get_or_bootstrap_default_tenant(company_name=company_name)

        user = User.objects.create_user(
            email=email, username=username, password=password, tenant=tenant, **extra
        )

        from roles.models import Role
        from roles.services import RoleService

        role_slug = "owner" if is_first_user else "member"
        role = Role.objects.filter(tenant__isnull=True, slug=role_slug).first()
        if role is not None:
            RoleService().assign_role(user=user, role=role)

        publish(Events.USER_CREATED, instance=user, actor=None)
        self.send_email_verification(user)
        return user

    # ------------------------------------------------------------------- login
    def login(
        self, *, email: str, password: str, remember_me: bool, ip: str | None, user_agent: str
    ) -> dict[str, Any]:
        if self._is_locked(email):
            raise RateLimitedError(
                "This account is temporarily locked after too many failed attempts."
            )

        user = django_authenticate(username=email, password=password)
        LoginAttempt.objects.create(
            email=email,
            ip_address=ip,
            user_agent=(user_agent or "")[:512],
            successful=user is not None,
        )

        if user is None:
            self._record_failure(email)
            raise AuthenticationFailedError("Incorrect email or password.")
        if not user.is_active:
            raise AuthenticationFailedError("This account is disabled.")

        self._clear_failures(email)
        tokens = self.issue_tokens(user, remember_me=remember_me, ip=ip, user_agent=user_agent)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        publish(Events.USER_LOGGED_IN, instance=user, actor=user)
        return tokens

    # ------------------------------------------------------------------ logout
    def logout(self, refresh_token: str) -> None:
        try:
            token = RefreshToken(refresh_token)
            jti = str(token["jti"])
            token.blacklist()
        except Exception as exc:  # noqa: BLE001 - invalid token is a client error
            raise ValidationError(
                detail={"refresh": ["Invalid or expired refresh token."]}
            ) from exc
        UserSession.objects.filter(jti=jti).update(revoked=True)

    def logout_everywhere(self, user: User) -> int:
        count = 0
        for outstanding in OutstandingToken.objects.filter(user=user):
            _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
            if created:
                count += 1
        UserSession.objects.filter(user=user, revoked=False).update(revoked=True)
        publish(Events.USER_LOGGED_OUT, instance=user, actor=user)
        return count

    # ---------------------------------------------------------- password reset
    def request_password_reset(self, email: str) -> None:
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        # Do not reveal whether the email exists.
        if user is None:
            return
        _, raw = PasswordResetToken.issue(user, settings.PASSWORD_RESET_TOKEN_TTL_SECONDS)
        send_mail(
            subject="Reset your password",
            message=f"Use this token to reset your password: {raw}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    def reset_password(self, *, token: str, new_password: str) -> None:
        record = PasswordResetToken.consume(token)
        if record is None:
            raise ValidationError(detail={"token": ["Invalid or expired token."]})
        validate_password(new_password, user=record.user)
        record.user.set_password(new_password)
        record.user.save(update_fields=["password"])
        self.logout_everywhere(record.user)
        publish(Events.PASSWORD_CHANGED, instance=record.user, actor=record.user)

    # ------------------------------------------------------------ verify email
    def send_email_verification(self, user: User) -> None:
        _, raw = EmailVerificationToken.issue(user, settings.EMAIL_VERIFICATION_TTL_SECONDS)
        send_mail(
            subject="Verify your email",
            message=f"Use this token to verify your email: {raw}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    def verify_email(self, *, token: str) -> User:
        record = EmailVerificationToken.consume(token)
        if record is None:
            raise ValidationError(detail={"token": ["Invalid or expired token."]})
        user = record.user
        user.is_email_verified = True
        if user.status == "invited":
            user.status = "active"
        user.save(update_fields=["is_email_verified", "status", "updated_at"])
        return user

    # --------------------------------------------------------- change password
    def change_password(self, *, user: User, current_password: str, new_password: str) -> None:
        if not user.check_password(current_password):
            raise ValidationError(detail={"current_password": ["Current password is incorrect."]})
        validate_password(new_password, user=user)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        self.logout_everywhere(user)
        publish(Events.PASSWORD_CHANGED, instance=user, actor=user)

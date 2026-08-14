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

from auth.face_engine import FaceAIClient, cosine_similarity, deserialize, serialize
from auth.models import (
    EmailVerificationToken,
    FaceCredential,
    LoginAttempt,
    PasswordResetToken,
    UserSession,
)


class AuthService(BaseService):
    # ---------------------------------------------------------------- lockout
    # Failed attempts are counted per identity (email for password login, IP
    # for face login). Once the count reaches AUTH_LOCKOUT_MAX_ATTEMPTS the
    # identity is throttled, but instead of a fixed "hard" lock the wait grows
    # exponentially with each further failure and always self-expires — a
    # legitimate user who mistypes a few times waits a short, escalating delay,
    # while an attacker faces a rapidly widening one, capped so it can never
    # become a permanent denial of service against a real account.
    def _backoff_seconds(self, failure_count: int) -> int:
        overflow = max(0, failure_count - settings.AUTH_LOCKOUT_MAX_ATTEMPTS)
        duration = settings.AUTH_LOCKOUT_BASE_BACKOFF_SECONDS * (
            settings.AUTH_LOCKOUT_BACKOFF_FACTOR**overflow
        )
        return int(min(duration, settings.AUTH_LOCKOUT_MAX_BACKOFF_SECONDS))

    def _locked(self, key: str) -> bool:
        return cache.get(key, 0) >= settings.AUTH_LOCKOUT_MAX_ATTEMPTS

    def _register_failure(self, key: str) -> None:
        try:
            count = cache.incr(key)
        except ValueError:
            # First failure in a fresh window: seed the counter with the
            # counting window TTL. It only escalates to a backoff TTL once the
            # threshold is crossed below.
            cache.set(key, 1, timeout=settings.AUTH_LOCKOUT_WINDOW_SECONDS)
            count = 1
        if count >= settings.AUTH_LOCKOUT_MAX_ATTEMPTS:
            cache.set(key, count, timeout=self._backoff_seconds(count))

    def _lockout_key(self, email: str) -> str:
        return f"auth:lockout:{email.lower()}"

    def _is_locked(self, email: str) -> bool:
        return self._locked(self._lockout_key(email))

    def _record_failure(self, email: str) -> None:
        self._register_failure(self._lockout_key(email))

    def _clear_failures(self, email: str) -> None:
        cache.delete(self._lockout_key(email))

    # ----------------------------------------------------------- face lockout
    # Keyed on IP, not email: a face-login attempt has no claimed email up
    # front (identity comes FROM the match), so the normal per-email lockout
    # above cannot apply here. Same exponential-backoff policy.
    def _face_lockout_key(self, ip: str | None) -> str:
        return f"auth:face_lockout:{ip or 'unknown'}"

    def _is_face_locked(self, ip: str | None) -> bool:
        return self._locked(self._face_lockout_key(ip))

    def _record_face_failure(self, ip: str | None) -> None:
        self._register_failure(self._face_lockout_key(ip))

    def _clear_face_failures(self, ip: str | None) -> None:
        cache.delete(self._face_lockout_key(ip))

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

    # ------------------------------------------------------- face (touchless)
    def enroll_face(self, *, user: User, image_bytes: bytes) -> FaceCredential:
        """Register/replace `user`'s face template from a reference photo.

        Strict quality gates run on the face-ai service (blur, side-profile,
        multiple faces); a rejected capture raises FaceError with a
        user-facing reason instead of silently storing a bad template.
        """
        embedding = FaceAIClient().enroll(image_bytes)
        credential, _ = FaceCredential.objects.update_or_create(
            user=user,
            defaults={"embedding": serialize(embedding), "enrolled_at": timezone.now()},
        )
        publish(Events.FACE_ENROLLED, instance=user, actor=user)
        return credential

    def revoke_face(self, *, user: User) -> bool:
        # Hard delete, not the usual soft-delete archive: a revoked biometric
        # template should not linger in the database, and `all_objects` +
        # `hard_delete()` avoids a stale soft-deleted row colliding with the
        # OneToOneField unique constraint on the next enrollment.
        deleted, _ = FaceCredential.all_objects.filter(user=user).hard_delete()
        if deleted:
            publish(Events.FACE_REVOKED, instance=user, actor=user)
        return bool(deleted)

    def face_status(self, *, user: User) -> FaceCredential | None:
        return FaceCredential.objects.filter(user=user).first()

    def login_face(
        self,
        *,
        image_bytes: bytes,
        extra_frames: list[bytes],
        ip: str | None,
        user_agent: str,
    ) -> dict[str, Any]:
        """Authenticate by face: 1:N match against every enrolled credential.

        A face-login attempt has no claimed email, so it cannot use the
        per-email lockout `login()` uses — it is rate-limited per IP instead
        (`_face_lockout_key`), on top of the endpoint's DRF throttle scope.
        """
        if self._is_face_locked(ip):
            raise RateLimitedError(
                "Too many failed face-login attempts. "
                "Wait a few minutes or sign in with your password."
            )

        probe_embedding, live = FaceAIClient().verify(image_bytes, extra_frames)
        if not live:
            self._record_face_failure(ip)
            raise AuthenticationFailedError(
                "Liveness check failed. Look directly at the camera, in good light, and try again."
            )

        best_score, runner_up, best_credential = -1.0, -1.0, None
        for credential in FaceCredential.objects.select_related("user"):
            score = cosine_similarity(probe_embedding, deserialize(credential.embedding))
            if score > best_score:
                best_score, runner_up, best_credential = score, best_score, credential
            elif score > runner_up:
                runner_up = score

        # A confident match must also beat the runner-up by a margin — without
        # it, two enrolled faces near the threshold could resolve arbitrarily.
        matched = (
            best_credential is not None
            and best_score >= settings.FACE_LOGIN_MATCH_THRESHOLD
            and (best_score - runner_up) >= settings.FACE_LOGIN_MARGIN
        )
        if not matched:
            self._record_face_failure(ip)
            LoginAttempt.objects.create(
                email=best_credential.user.email if best_credential else "",
                ip_address=ip,
                user_agent=(user_agent or "")[:512],
                successful=False,
            )
            raise AuthenticationFailedError("Face not recognized. Use your password instead.")

        user = best_credential.user
        if not user.is_active:
            raise AuthenticationFailedError("This account is disabled.")

        self._clear_face_failures(ip)
        LoginAttempt.objects.create(
            email=user.email, ip_address=ip, user_agent=(user_agent or "")[:512], successful=True
        )
        tokens = self.issue_tokens(user, remember_me=False, ip=ip, user_agent=user_agent)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        publish(Events.USER_LOGGED_IN, instance=user, actor=user)
        return tokens

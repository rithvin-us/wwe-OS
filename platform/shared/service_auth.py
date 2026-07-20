"""Service-to-service authentication.

Untrusted-network services that push data INTO the platform — the Telegram
bot, the future email service, the OCR service — are not human users and
never hold a JWT. They authenticate with a static, per-service shared secret
instead:

    Authorization: Service <token>

Configured via the `INGESTION_SERVICE_TOKENS` environment variable:

    INGESTION_SERVICE_TOKENS=telegram-bot:<token>,email-service:<token>

Reused by every ingestion channel — never reimplement this per module. A
request authenticated this way carries a `ServiceActor`, not a `User`: it is
never a row in the database, never appears in the audit `actor` FK (audit
records the action with `actor=None` and still captures IP/module/changes),
and can only reach the specific views that opt in via
`ServiceTokenAuthentication` — never the human-facing JWT-protected API.
"""

from __future__ import annotations

import hmac
from dataclasses import dataclass, field

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.throttling import ScopedRateThrottle

from shared import context


@dataclass(frozen=True)
class ServiceActor:
    """Stand-in for `request.user` on service-authenticated requests.

    Duck-types enough of Django's user interface (`pk`, `is_authenticated`,
    …) that generic DRF machinery — throttling's cache-key builder in
    particular, which reads `request.user.pk` unconditionally — doesn't
    break just because this isn't a real database row. Found by actually
    running the ingest endpoint, not by unit tests: the test settings
    disable throttling entirely, so this exact crash was invisible to pytest.
    """

    name: str
    is_authenticated: bool = field(default=True, init=False)
    is_service: bool = field(default=True, init=False)
    is_superuser: bool = field(default=False, init=False)
    is_staff: bool = field(default=False, init=False)

    @property
    def pk(self) -> str:
        return f"service:{self.name}"

    def has_platform_permission(self, _code: str) -> bool:
        # Services only ever reach the narrow endpoints that opted into
        # ServiceTokenAuthentication in the first place — they carry no
        # platform permissions of their own.
        return False


def _configured_tokens() -> dict[str, str]:
    raw = getattr(settings, "INGESTION_SERVICE_TOKENS", "") or ""
    tokens: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        name, _, token = pair.partition(":")
        name, token = name.strip(), token.strip()
        if name and token:
            tokens[name] = token
    return tokens


class ServiceTokenAuthentication(BaseAuthentication):
    """Validates the `Authorization: Service <token>` header."""

    keyword = "Service"

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header:
            return None
        scheme, _, credential = header.partition(" ")
        if scheme != self.keyword or not credential:
            return None

        for name, configured_token in _configured_tokens().items():
            if hmac.compare_digest(credential, configured_token):
                actor = ServiceActor(name=name)
                context.set_context(user=None, tenant=None, tenant_id=None)
                return (actor, None)

        raise AuthenticationFailed("Invalid service token.")

    def authenticate_header(self, request) -> str:
        return self.keyword


class IngestionRateThrottle(ScopedRateThrottle):
    """Ingestion channels share one rate-limit pool, separate from human
    users — a misbehaving bot shouldn't be able to eat into a person's
    throttle budget, or vice versa. Views opt in with `scope = "ingestion"`.
    """

    scope = "ingestion"


class ServiceTokenScheme(OpenApiAuthenticationExtension):
    """Documents ServiceTokenAuthentication in the OpenAPI schema."""

    target_class = "shared.service_auth.ServiceTokenAuthentication"
    name = "serviceTokenAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": 'Ingestion channels only. Format: "Service <token>".',
        }

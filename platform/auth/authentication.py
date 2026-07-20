"""Platform JWT authentication.

Extends SimpleJWT so that, once the user is resolved, the current tenant and
actor are pushed into the request context — this is where API requests (which
bypass Django's session middleware) get their tenant scoping.
"""

from __future__ import annotations

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework_simplejwt.authentication import JWTAuthentication
from shared import context


class PlatformJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            context.set_context(
                user=user,
                tenant=getattr(user, "tenant", None),
                tenant_id=getattr(user, "tenant_id", None),
            )
        return result


class PlatformJWTScheme(OpenApiAuthenticationExtension):
    """Teaches drf-spectacular how to document our JWT auth (Bearer token)."""

    target_class = "auth.authentication.PlatformJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}

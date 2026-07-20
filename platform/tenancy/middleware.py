"""Tenant resolution middleware.

For session-authenticated requests (e.g. Django admin) this resolves the
tenant from the user. JWT/API requests resolve the tenant inside the
authentication class (auth.authentication.PlatformJWTAuthentication), which
runs later than middleware; this middleware simply leaves context untouched
in that case so the auth class can populate it.
"""

from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from shared import context


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            tenant = getattr(user, "tenant", None)
            if tenant is not None:
                context.set_context(tenant=tenant, tenant_id=tenant.id, user=user)
        return self.get_response(request)

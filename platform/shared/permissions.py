"""DRF permission that enforces granular platform permissions.

A view declares the permission code(s) it needs; this checks the requesting
user's effective permissions (resolved from their roles, with inheritance).
Superusers bypass. Business modules will reuse this exact mechanism.
"""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission


class HasPlatformPermission(BasePermission):
    """Reads `required_permissions` from the view.

    Forms supported:
    - `required_permissions = "users.read"`
    - `required_permissions = {"list": "users.read", "create": "users.write"}`
    - `required_permissions = {"default": "users.read", "create": "users.write"}`
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request: Any, view: Any) -> bool:
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True

        required = getattr(view, "required_permissions", None)
        if not required:
            return True

        code = self._resolve_code(required, getattr(view, "action", None), request.method)
        if code is None:
            return True
        return user.has_platform_permission(code)

    @staticmethod
    def _resolve_code(required: Any, action: str | None, method: str) -> str | None:
        if isinstance(required, str):
            return required
        if isinstance(required, dict):
            if action and action in required:
                return required[action]
            if method in required:
                return required[method]
            return required.get("default")
        return None

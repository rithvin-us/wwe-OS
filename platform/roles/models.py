"""Enterprise RBAC.

- System roles (tenant is null) ship with the platform.
- Custom roles belong to a tenant.
- Roles inherit permissions from an optional parent (single inheritance).
- Users receive roles through UserRole.

Department- and module-scoped role mapping (Stage 2) attaches to Role without
reshaping this model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import BaseModel


class Role(BaseModel):
    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
        db_index=True,
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children"
    )
    permissions = models.ManyToManyField("permissions.Permission", related_name="roles", blank=True)

    class Meta(BaseModel.Meta):
        db_table = "roles_role"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "slug"],
                name="uniq_role_slug_per_tenant",
                condition=models.Q(tenant__isnull=False),
            ),
            models.UniqueConstraint(
                fields=["slug"],
                name="uniq_system_role_slug",
                condition=models.Q(tenant__isnull=True),
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def permission_codes(self, _seen: set | None = None) -> set[str]:
        """This role's permissions plus all inherited from ancestors."""
        seen = _seen or set()
        if self.id in seen:
            return set()
        seen.add(self.id)
        codes = set(self.permissions.values_list("code", flat=True))
        if self.parent_id:
            codes |= self.parent.permission_codes(seen)
        return codes


class UserRole(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_roles"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="assignments")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="roles_assigned",
    )

    class Meta(BaseModel.Meta):
        db_table = "roles_user_role"
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="uniq_user_role"),
        ]

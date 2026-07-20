from __future__ import annotations

from django.db import transaction
from permissions.models import Permission
from shared.events import Events, publish
from shared.exceptions import ConflictError
from shared.services import BaseService

from roles.models import Role, UserRole


class RoleService(BaseService):
    def effective_permission_codes(self, user) -> set[str]:
        """Union of permission codes across all of a user's roles (inherited)."""
        codes: set[str] = set()
        roles = (
            Role.objects.filter(assignments__user=user)
            .prefetch_related("permissions", "parent__permissions")
            .distinct()
        )
        for role in roles:
            codes |= role.permission_codes()
        return codes

    @transaction.atomic
    def create_role(
        self, *, tenant, name, slug, permission_codes=None, parent=None, description=""
    ):
        if Role.objects.filter(tenant=tenant, slug=slug).exists():
            raise ConflictError("A role with this slug already exists for the tenant.")
        role = Role.objects.create(
            tenant=tenant, name=name, slug=slug, parent=parent, description=description
        )
        if permission_codes:
            role.permissions.set(Permission.objects.filter(code__in=permission_codes))
        publish(Events.ROLE_CREATED, instance=role)
        return role

    def set_permissions(self, role: Role, permission_codes: list[str]) -> Role:
        role.permissions.set(Permission.objects.filter(code__in=permission_codes))
        publish(Events.ROLE_CHANGED, instance=role, changes={"permissions": permission_codes})
        return role

    def assign_role(self, *, user, role: Role, assigned_by=None) -> UserRole:
        assignment, created = UserRole.objects.get_or_create(
            user=user, role=role, defaults={"assigned_by": assigned_by}
        )
        if created:
            publish(Events.ROLE_ASSIGNED, instance=assignment, actor=assigned_by)
        return assignment

    def revoke_role(self, *, user, role: Role) -> None:
        UserRole.objects.filter(user=user, role=role).delete()
        publish(Events.PERMISSION_ASSIGNED, instance=role, actor=user)

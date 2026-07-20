from __future__ import annotations

import pytest
from permissions.models import Permission
from roles.models import Role
from roles.services import RoleService

pytestmark = pytest.mark.django_db


def test_effective_permissions_include_inherited(make_user, tenant):
    parent = Role.objects.create(tenant=tenant, name="Parent", slug="parent")
    parent.permissions.set(Permission.objects.filter(code="users.read"))
    child = Role.objects.create(tenant=tenant, name="Child", slug="child", parent=parent)
    child.permissions.set(Permission.objects.filter(code="users.write"))

    user = make_user(tenant=tenant)
    RoleService().assign_role(user=user, role=child)

    codes = RoleService().effective_permission_codes(user)
    assert {"users.read", "users.write"} <= codes


def test_permission_enforced_on_endpoint(
    make_user, tenant, auth_client, grant, member_role, owner_role
):
    user = make_user(tenant=tenant)

    grant(user, member_role)  # dashboard.view only — no users.read
    assert auth_client(user).get("/api/v1/users/").status_code == 403

    grant(user, owner_role)  # owner has users.read
    assert auth_client(user).get("/api/v1/users/").status_code == 200


def test_role_assignment_via_service(make_user, tenant, member_role):
    user = make_user(tenant=tenant)
    RoleService().assign_role(user=user, role=member_role)
    assert user.has_platform_permission("dashboard.view")
    assert not user.has_platform_permission("users.write")


def test_superuser_bypasses_permission_checks(make_user, tenant, auth_client):
    admin = make_user(
        email="root@acme.test", username="root", tenant=tenant, is_superuser=True, is_staff=True
    )
    # No roles assigned, but superuser sees everything.
    assert auth_client(admin).get("/api/v1/users/").status_code == 200

from __future__ import annotations

import pytest
from django.core.cache import cache
from permissions.models import Permission
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from roles.models import Role
from roles.services import RoleService
from tenancy.models import Tenant
from users.models import User

PASSWORD = "Str0ng!Pass1"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def tenant(db) -> Tenant:
    return Tenant.objects.create(name="Acme", slug="acme")


@pytest.fixture
def other_tenant(db) -> Tenant:
    return Tenant.objects.create(name="Globex", slug="globex")


@pytest.fixture
def make_user(db):
    def _make(email="user@acme.test", username="user", tenant=None, **extra):
        return User.objects.create_user(
            email=email,
            username=username,
            password=PASSWORD,
            tenant=tenant,
            status="active",
            is_email_verified=True,
            **extra,
        )

    return _make


@pytest.fixture
def owner_role(db) -> Role:
    return Role.objects.get(slug="owner")


@pytest.fixture
def member_role(db) -> Role:
    return Role.objects.get(slug="member")


@pytest.fixture
def auth_client():
    """Return an APIClient authenticated as the given user via a real JWT."""

    def _auth(user: User) -> APIClient:
        client = APIClient()
        access = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return client

    return _auth


@pytest.fixture
def grant():
    """Assign a role to a user."""

    def _grant(user: User, role: Role) -> None:
        RoleService().assign_role(user=user, role=role)

    return _grant


@pytest.fixture
def make_role(db):
    def _make(tenant, slug, codes):
        role = Role.objects.create(tenant=tenant, name=slug.title(), slug=slug)
        role.permissions.set(Permission.objects.filter(code__in=codes))
        return role

    return _make

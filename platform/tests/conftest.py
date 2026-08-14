from __future__ import annotations

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_test")
django.setup()

import pytest  # noqa: E402
from django.core.cache import cache  # noqa: E402
from permissions.models import Permission  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402
from roles.models import Role  # noqa: E402
from roles.services import RoleService  # noqa: E402
from tenancy.models import Tenant  # noqa: E402
from users.models import User  # noqa: E402

PASSWORD = "Str0ng!Pass1"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _storage_root(settings, tmp_path):
    # Keep any file a test stores (e.g. a rendered report) inside the temp dir,
    # never in the repo's local .storage.
    settings.STORAGE_LOCAL_PATH = str(tmp_path / "objects")


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

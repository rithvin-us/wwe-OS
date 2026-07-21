"""Fixtures for the contracts module test suite — self-contained."""

from __future__ import annotations

import pytest
from django.core.cache import cache
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


@pytest.fixture(autouse=True)
def _storage_root(settings, tmp_path):
    settings.STORAGE_LOCAL_PATH = str(tmp_path / "objects")


@pytest.fixture
def tenant(db) -> Tenant:
    return Tenant.objects.create(name="Acme", slug="acme")


@pytest.fixture
def other_tenant(db) -> Tenant:
    return Tenant.objects.create(name="Globex", slug="globex")


@pytest.fixture
def make_user(db):
    def _make(email, username, tenant=None, **extra):
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
def owner(make_user, tenant) -> User:
    user = make_user("owner@acme.test", "owner", tenant=tenant)
    RoleService().assign_role(user=user, role=Role.objects.get(slug="owner"))
    return user


@pytest.fixture
def auth_client():
    def _auth(user: User) -> APIClient:
        client = APIClient()
        access = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return client

    return _auth

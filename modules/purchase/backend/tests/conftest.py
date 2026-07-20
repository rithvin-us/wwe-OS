"""Fixtures for the purchase module's own test suite.

Deliberately self-contained rather than importing platform/tests/conftest.py
— a module's tests should never depend on another test tree, the same way
its runtime code never imports another module directly.
"""

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
SERVICE_TOKEN = "test-telegram-bot-token"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _service_token(settings):
    settings.INGESTION_SERVICE_TOKENS = f"telegram-bot:{SERVICE_TOKEN}"


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def tenant(db) -> Tenant:
    return Tenant.objects.create(name="Acme", slug="acme")


@pytest.fixture
def owner(db, tenant) -> User:
    user = User.objects.create_user(
        email="owner@acme.test",
        username="owner",
        password=PASSWORD,
        tenant=tenant,
        status="active",
        is_email_verified=True,
    )
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


@pytest.fixture
def service_client() -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Service {SERVICE_TOKEN}")
    return client

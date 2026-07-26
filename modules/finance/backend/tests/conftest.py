"""Fixtures for the finance module test suite — self-contained, same shape as
the other modules' conftests."""

from __future__ import annotations

from datetime import date

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from roles.models import Role
from roles.services import RoleService
from tenancy.models import Tenant
from users.models import User

PASSWORD = "Str0ng!Pass1"
INVOICE_DATE = date(2026, 7, 26)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _storage_root(settings, tmp_path):
    """Both the platform's object store and the invoice archive point at the
    temp directory, so a test can assert the workbook really reached disk."""
    settings.STORAGE_BACKEND = "local"
    settings.STORAGE_LOCAL_PATH = str(tmp_path / "objects")
    settings.INVOICE_LOCAL_ARCHIVE_PATH = str(tmp_path / "objects")


@pytest.fixture
def tenant(db) -> Tenant:
    return Tenant.objects.create(name="Acme", slug="acme")


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


@pytest.fixture
def customer(tenant):
    # Imported inside the fixture: pytest loads conftest files before
    # pytest-django puts `modules/` on sys.path.
    from finance.backend.models.invoice import Customer

    return Customer.objects.create(
        tenant=tenant,
        name="Waterworks Engineering Pvt Ltd",
        address="12 Industrial Estate, Coimbatore",
        facility="Peelamedu Plant",
        gstin="33AABFW6153H1Z8",
        state="Tamil Nadu",
        is_sez=False,
    )


@pytest.fixture
def sez_customer(tenant):
    from finance.backend.models.invoice import Customer

    return Customer.objects.create(
        tenant=tenant,
        name="Apex Industrial Machinery",
        address="SEZ Unit 4, Sriperumbudur",
        facility="SEZ Block C",
        is_sez=True,
    )


@pytest.fixture
def line_items():
    def _lines(count: int = 1):
        return [
            {
                "description": f"Water treatment service {index}",
                "hsn": "998719",
                "quantity": 1,
                "uom": "Nos",
                "rate": 10000,
            }
            for index in range(1, count + 1)
        ]

    return _lines

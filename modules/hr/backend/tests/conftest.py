"""Fixtures for the HR module's own test suite.

Deliberately self-contained rather than importing platform/tests/conftest.py
or another module's — a module's tests should never depend on another test
tree, the same way its runtime code never imports another module directly.
"""

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

from hr.backend.models import Employee, PayRulesConfig, SalaryRule

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
    return Tenant.objects.create(name="Water Works Engineering", slug="wwe")


@pytest.fixture
def owner(db, tenant) -> User:
    user = User.objects.create_user(
        email="owner@wwe.test",
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
def pay_rules(db, tenant) -> PayRulesConfig:
    """The statutory defaults the legacy app shipped with."""
    return PayRulesConfig.objects.create(
        tenant=tenant,
        effective_from=date(2020, 1, 1),
        description="Migration default",
    )


@pytest.fixture
def employee_factory(db, tenant):
    def _make(
        code: str = "C-0001",
        name: str = "Test Employee",
        doj: date = date(2024, 1, 1),
        dol: date | None = None,
        salary: float = 15000.0,
        pf_number: str = "PF001",
        uan: str = "UAN001",
        esic_number: str = "ESIC001",
        **extra,
    ) -> Employee:
        return Employee.objects.create(
            tenant=tenant,
            employee_code=code,
            employee_name=name,
            date_of_joining=doj,
            date_of_leaving=dol,
            salary=salary,
            pf_number=pf_number,
            uan=uan,
            esic_number=esic_number,
            **extra,
        )

    return _make


@pytest.fixture
def salary_rule_factory(db, tenant):
    def _make(
        employee: Employee | None = None,
        basic: float = 7500.0,
        da: float = 3750.0,
        hra: float = 2250.0,
        medical_allowance: float = 900.0,
        conveyance_allowance: float = 600.0,
        ot_rate: float = 0.0,
        effective_from: date = date(2024, 1, 1),
    ) -> SalaryRule:
        return SalaryRule.objects.create(
            tenant=tenant,
            employee=employee,
            basic=basic,
            da=da,
            hra=hra,
            medical_allowance=medical_allowance,
            conveyance_allowance=conveyance_allowance,
            ot_rate=ot_rate,
            effective_from=effective_from,
        )

    return _make

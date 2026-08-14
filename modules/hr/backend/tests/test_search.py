"""HR is wired into the one platform search index.

Creating, updating and offboarding an employee keeps its search document in
step, and the document is reachable through the same permission-aware
`SearchService` the command palette queries. The platform owns
querying/ranking/tenant-isolation — these tests only prove the module declared
itself correctly and indexes at the right moments.
"""

from __future__ import annotations

from datetime import date

import pytest
from search.models import SearchDocument
from search.services import SearchService
from shared import context

from hr.backend.models import EmployeeStatus
from hr.backend.services.employee import EmployeeService

pytestmark = pytest.mark.django_db

INDEX = "employees"


@pytest.fixture(autouse=True)
def _as_tenant(tenant):
    """Run the whole test inside the tenant context so every service call —
    create, offboard, and the permission-aware search read — resolves the same
    valid tenant (the platform's audit/search paths read it from context).

    Clears the thread-local on the way out so nothing leaks into the next test
    or module (services read the tenant from this thread-local, and it is not
    otherwise reset between tests)."""
    context.set_context(tenant=tenant, tenant_id=tenant.id)
    try:
        yield
    finally:
        context.clear_context()


def _create(tenant, **overrides):
    data = {
        "employee_code": "C-9001",
        "employee_name": "Ravi Kumar",
        "designation": "Plant Operator",
        "department": "Operations",
        "date_of_joining": date(2026, 1, 1),
        "salary": 18000.0,
    }
    data.update(overrides)
    return EmployeeService().create(data)


def test_creating_an_employee_indexes_it(tenant):
    employee = _create(tenant)

    doc = SearchDocument.objects.get(index=INDEX, doc_id=str(employee.pk))
    assert employee.employee_name in doc.title
    assert employee.employee_code in doc.title
    assert doc.url == "/hr/employees"
    assert doc.extra["status"] == EmployeeStatus.ACTIVE
    assert doc.extra["designation"] == "Plant Operator"


def test_search_finds_an_employee_by_code(tenant, owner):
    employee = _create(tenant)

    result = SearchService().search(user=owner, query=employee.employee_code, indexes=[INDEX])

    doc_ids = {row["doc_id"] for row in result["results"]}
    assert str(employee.pk) in doc_ids


def test_offboarding_keeps_the_employee_indexed_with_its_new_status(tenant):
    employee = _create(tenant)
    EmployeeService().offboard(employee, date(2026, 6, 30))

    doc = SearchDocument.objects.get(index=INDEX, doc_id=str(employee.pk))
    assert doc.extra["status"] == EmployeeStatus.LEFT


def test_search_is_gated_by_the_hr_read_permission(tenant, db):
    """A user without hr.employee.read must not see employees in results."""
    from users.models import User

    _create(tenant)
    stranger = User.objects.create_user(
        email="stranger@wwe.test",
        username="stranger",
        password="Str0ng!Pass1",
        tenant=tenant,
        status="active",
        is_email_verified=True,
    )

    result = SearchService().search(user=stranger, query="Ravi", indexes=[INDEX])

    assert result["results"] == []

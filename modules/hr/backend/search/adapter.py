"""Search adapter registration for HR employees.

Registers the employee master with the platform search engine so a person is
reachable from the one command palette (Ctrl/⌘ K) alongside invoices,
purchases, documents and the rest. The platform owns querying, ranking, tenant
isolation and permission enforcement; this module only declares how one
employee becomes a search document.

Indexing is driven from `EmployeeService` (create/update/offboard) — the same
service-layer pattern assets, inventory, contracts and documents already use.
An offboarded employee is never deleted (status becomes LEFT), so it stays
indexed with its new status rather than vanishing.
"""

from __future__ import annotations

from search.registry import SearchAdapter, register

from hr.backend.models import Employee

INDEX = "employees"


def to_document(employee: Employee) -> dict:
    body = " ".join(
        filter(
            None,
            [
                employee.employee_code,
                employee.designation,
                employee.department,
                employee.phone,
                employee.location,
                employee.skill_category,
            ],
        )
    )
    return {
        "doc_id": str(employee.pk),
        "title": f"{employee.employee_name} · {employee.employee_code}",
        "body": body,
        "extra": {
            "status": employee.status,
            "designation": employee.designation,
            "department": employee.department,
            "location": employee.location,
        },
        "url": "/hr/employees",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Employees",
            permission="hr.employee.read",
            to_document=to_document,
            queryset=lambda: Employee.objects.all(),
        )
    )

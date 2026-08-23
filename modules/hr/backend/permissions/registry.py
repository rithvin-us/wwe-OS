"""HR module's own permission vocabulary.

Synced into the shared Permission table by `hr.backend.apps` on migrate — the
platform owns the mechanism (see platform/permissions), this module owns these
codes. Enforced the same way as any platform endpoint, via
`shared.permissions.HasPlatformPermission` and each view's
`required_permissions`.

The whole vocabulary is declared up front, including codes for subsystems
still landing (see docs/specs/hr-migration.md § 6), so the Owner role picks
them up in one sync rather than needing a re-migrate per wave.
"""

from __future__ import annotations

from permissions.registry import PermissionDef

HR_PERMISSIONS: list[PermissionDef] = [
    # Employee master
    PermissionDef("hr.employee.read", "View employees", "HR"),
    PermissionDef("hr.employee.manage", "Add, edit and offboard employees", "HR"),
    PermissionDef("hr.employee.enroll", "Enrol an employee's check-in face", "HR"),
    # Attendance
    PermissionDef("hr.attendance.read", "View attendance", "HR"),
    PermissionDef("hr.attendance.manage", "Record and correct attendance", "HR"),
    # Payroll and wage configuration
    PermissionDef("hr.payroll.read", "View payroll", "HR"),
    PermissionDef("hr.payroll.run", "Run payroll for a month", "HR"),
    PermissionDef("hr.salary_rule.manage", "Manage per-employee salary structures", "HR"),
    PermissionDef("hr.pay_rules.manage", "Manage statutory pay rules", "HR"),
    # Supporting data
    PermissionDef("hr.holiday.manage", "Manage the holiday calendar", "HR"),
    PermissionDef("hr.deduction.manage", "Record advances, fines and damages", "HR"),
    # Statutory registers
    PermissionDef("hr.register.generate", "Generate statutory registers", "HR"),
    PermissionDef("hr.register.read", "View generated registers and history", "HR"),
    # Leave
    PermissionDef("hr.leave.read", "View leave requests and balances", "HR"),
    PermissionDef("hr.leave.manage", "Approve or reject leave", "HR"),
    # Onboarding
    PermissionDef("hr.onboarding.manage", "Run employee onboarding checklists", "HR"),
    # Expense claims
    PermissionDef("hr.expense.read", "View expense claims", "HR"),
    PermissionDef("hr.expense.manage", "Approve or reject expense claims", "HR"),
    # Diagnostics
    PermissionDef("hr.diagnostics.read", "View face check-in engine diagnostics", "HR"),
]

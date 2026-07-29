"""Import the legacy AutoSync HR database into WWE OS.

    python manage.py import_legacy_hr --source <sqlite-path-or-postgres-url> --tenant <slug>

Dry run by default: it reports exactly what it *would* write and changes
nothing. Pass `--commit` to actually write.

Non-destructive in both modes — it only ever reads from the source, and writes
into WWE OS tables. The legacy database is never modified, so a failed or
partial import can simply be re-run.

Idempotent: every row is matched on its natural key (employee code, then
employee+period), so re-running updates rather than duplicating. That matters
because the realistic cutover is "import, check, import again after a few more
days of legacy use".

Deliberately NOT imported:
  * `users` — WWE OS owns identity (platform/auth). Legacy logins do not carry
    across; the operator signs in with their WWE OS account.
  * `audit_logs` — the legacy trail stays with the legacy system. Fabricating
    WWE OS audit rows for actions that happened in another application would
    make the audit trail lie about its own provenance.
  * `device_tokens` — dead in the legacy app too; 1:N face identification
    replaced device binding.

See docs/specs/hr-migration.md § 8.
"""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from tenancy.models import Tenant

from hr.backend.models import (
    Attendance,
    Deduction,
    Employee,
    Holiday,
    Payroll,
    PayRulesConfig,
    SalaryRule,
)


class _Source:
    """Minimal read-only cursor over the legacy database.

    Supports sqlite (a file path) and PostgreSQL (a URL) so the command works
    against both a local dev copy and the deployed legacy database.
    """

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.is_sqlite = not dsn.startswith(("postgres://", "postgresql://"))
        self._connection: Any = None

    def __enter__(self) -> _Source:
        if self.is_sqlite:
            path = Path(self.dsn)
            if not path.exists():
                raise CommandError(f"Legacy database not found: {path}")
            self._connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            self._connection.row_factory = sqlite3.Row
        else:
            try:
                import psycopg
            except ImportError as exc:  # pragma: no cover - depends on install
                raise CommandError("Reading a PostgreSQL source needs psycopg installed.") from exc
            self._connection = psycopg.connect(self.dsn)
        return self

    def __exit__(self, *_exc: object) -> None:
        if self._connection is not None:
            self._connection.close()

    def rows(self, table: str) -> list[dict]:
        """Every row of a table as dicts. Returns [] if the table is absent."""
        try:
            if self.is_sqlite:
                cursor = self._connection.execute(f'SELECT * FROM "{table}"')
                return [dict(row) for row in cursor.fetchall()]
            with closing(self._connection.cursor()) as cursor:
                cursor.execute(f'SELECT * FROM "{table}"')
                columns = [c.name for c in cursor.description]
                return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
        except Exception:
            return []


class Command(BaseCommand):
    help = "Import the legacy AutoSync HR database into WWE OS (dry run unless --commit)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--source",
            required=True,
            help="Path to the legacy sqlite file, or a postgres:// URL.",
        )
        parser.add_argument(
            "--tenant",
            required=True,
            help="Slug of the WWE OS tenant to import into.",
        )
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Actually write. Without this the command only reports.",
        )

    def handle(self, *args, **options) -> None:
        tenant = Tenant.objects.filter(slug=options["tenant"]).first()
        if tenant is None:
            raise CommandError(f"No tenant with slug '{options['tenant']}'.")

        commit = options["commit"]
        counts: dict[str, dict[str, int]] = {}

        with _Source(options["source"]) as source, transaction.atomic():
            employee_map = self._import_employees(source, tenant, counts)
            self._import_pay_rules(source, tenant, counts)
            self._import_holidays(source, tenant, counts)
            self._import_salary_rules(source, tenant, employee_map, counts)
            self._import_attendance(source, tenant, employee_map, counts)
            self._import_deductions(source, tenant, employee_map, counts)
            self._import_payroll(source, tenant, employee_map, counts)

            if not commit:
                transaction.set_rollback(True)

        self._report(counts, commit)

    # Legacy HR data importers.

    def _import_employees(
        self, source: _Source, tenant: Tenant, counts: dict
    ) -> dict[int, Employee]:
        """Employees keyed by their legacy integer id, for the FKs that follow."""
        mapping: dict[int, Employee] = {}
        created = updated = 0

        for row in source.rows("employees"):
            defaults = {
                "employee_name": row["employee_name"],
                "father_husband_name": row.get("father_husband_name") or "",
                "gender": row.get("gender") or "M",
                "dob": row.get("dob"),
                "address": row.get("address") or "",
                "phone": row.get("phone") or "",
                "designation": row.get("designation") or "Operator",
                "department": row.get("department") or "",
                "date_of_joining": row["date_of_joining"],
                "date_of_leaving": row.get("date_of_leaving"),
                "salary": row.get("salary") or 0.0,
                "pf_number": row.get("pf_number") or "",
                "uan": row.get("uan") or "",
                "esic_number": row.get("esic_number") or "",
                "bank_name": row.get("bank_name") or "",
                "bank_account": row.get("bank_account") or "",
                "ifsc_code": row.get("ifsc_code") or "",
                "status": row.get("status") or "Active",
                "skill_category": row.get("skill_category") or "Semi Skilled",
                "location": row.get("location") or "Coimbatore",
                "shift": row.get("shift") or "G",
                # Face templates carry across: they are derived data the
                # employee already consented to, and re-enrolling everyone would
                # mean gathering fresh photos for no benefit.
                "face_embedding": row.get("face_embedding") or "",
                "enrolled_at": row.get("enrolled_at"),
            }
            employee, was_created = Employee.objects.update_or_create(
                tenant=tenant, employee_code=row["employee_code"], defaults=defaults
            )
            mapping[row["id"]] = employee
            created += was_created
            updated += not was_created

        counts["employees"] = {"created": created, "updated": updated}
        return mapping

    def _import_pay_rules(self, source: _Source, tenant: Tenant, counts: dict) -> None:
        created = updated = 0
        for row in source.rows("pay_rules_config"):
            _, was_created = PayRulesConfig.objects.update_or_create(
                tenant=tenant,
                effective_from=row["effective_from"],
                defaults={
                    "effective_to": row.get("effective_to"),
                    "standard_days_per_month": row.get("standard_days_per_month") or 26,
                    "standard_hours_per_day": row.get("standard_hours_per_day") or 8,
                    "ot_multiplier": row.get("ot_multiplier") or 2.0,
                    "pf_employee_percent": row.get("pf_employee_percent") or 12.0,
                    "pf_employer_percent": row.get("pf_employer_percent") or 13.0,
                    "pf_cap": row.get("pf_cap") or 1800.0,
                    "esi_employee_percent": row.get("esi_employee_percent") or 0.75,
                    "esi_employer_percent": row.get("esi_employer_percent") or 3.25,
                    "esi_wage_ceiling": row.get("esi_wage_ceiling") or 21000.0,
                    "esi_cap": row.get("esi_cap") or 158.0,
                    "lwf_employee": row.get("lwf_employee") or 0.0,
                    "lwf_employer": row.get("lwf_employer") or 0.0,
                    "description": row.get("description") or "",
                },
            )
            created += was_created
            updated += not was_created
        counts["pay_rules_config"] = {"created": created, "updated": updated}

    def _import_holidays(self, source: _Source, tenant: Tenant, counts: dict) -> None:
        created = updated = 0
        for row in source.rows("holidays"):
            _, was_created = Holiday.objects.update_or_create(
                tenant=tenant,
                date=row["date"],
                defaults={
                    "name": row["name"],
                    "type": row.get("type") or "National",
                    "year": row.get("year") or int(str(row["date"])[:4]),
                },
            )
            created += was_created
            updated += not was_created
        counts["holidays"] = {"created": created, "updated": updated}

    def _import_salary_rules(
        self, source: _Source, tenant: Tenant, employees: dict, counts: dict
    ) -> None:
        created = updated = 0
        for row in source.rows("salary_rules"):
            employee = employees.get(row.get("employee_id")) if row.get("employee_id") else None
            _, was_created = SalaryRule.objects.update_or_create(
                tenant=tenant,
                employee=employee,
                effective_from=row["effective_from"],
                defaults={
                    "wage_type": row.get("wage_type") or "Monthly",
                    "basic": row.get("basic") or 0.0,
                    "da": row.get("da") or 0.0,
                    "hra": row.get("hra") or 0.0,
                    "medical_allowance": row.get("medical_allowance") or 0.0,
                    "conveyance_allowance": row.get("conveyance_allowance") or 0.0,
                    "ot_rate": row.get("ot_rate") or 0.0,
                    "effective_to": row.get("effective_to"),
                },
            )
            created += was_created
            updated += not was_created
        counts["salary_rules"] = {"created": created, "updated": updated}

    def _import_attendance(
        self, source: _Source, tenant: Tenant, employees: dict, counts: dict
    ) -> None:
        created = updated = skipped = 0
        for row in source.rows("attendance"):
            employee = employees.get(row.get("employee_id"))
            if employee is None:
                skipped += 1
                continue
            _, was_created = Attendance.objects.update_or_create(
                tenant=tenant,
                employee=employee,
                year=row["year"],
                month=row["month"],
                day=row["day"],
                defaults={
                    "status": row.get("status") or "P",
                    "shift": row.get("shift") or "G",
                    "in_time": row.get("in_time") or "",
                    "out_time": row.get("out_time") or "",
                    # The stored per-day values come across as-is: monthly OT is
                    # SUM(daily OT), so recomputing them here would silently
                    # restate history.
                    "worked_hours": row.get("worked_hours"),
                    "ot_hours": row.get("ot_hours"),
                },
            )
            created += was_created
            updated += not was_created
        counts["attendance"] = {"created": created, "updated": updated, "skipped": skipped}

    def _import_deductions(
        self, source: _Source, tenant: Tenant, employees: dict, counts: dict
    ) -> None:
        created = skipped = 0
        for row in source.rows("deductions"):
            employee = employees.get(row.get("employee_id"))
            if employee is None:
                skipped += 1
                continue
            # No natural key beyond the row itself, so match on the whole tuple
            # that identifies one recorded deduction.
            _, was_created = Deduction.objects.get_or_create(
                tenant=tenant,
                employee=employee,
                year=row["year"],
                month=row["month"],
                type=row.get("type") or "Advance",
                amount=row.get("amount") or 0.0,
                defaults={
                    "date_of_payment": row.get("date_of_payment"),
                    "installments": row.get("installments"),
                    "recovery_date": row.get("recovery_date"),
                    "recovery_amount": row.get("recovery_amount") or 0.0,
                    "is_recovered": bool(row.get("is_recovered")),
                    "damage_description": row.get("damage_description") or "",
                    "showcause_date": row.get("showcause_date"),
                    "act_or_omission": row.get("act_or_omission") or "",
                    "description": row.get("description") or "",
                },
            )
            created += was_created
        counts["deductions"] = {"created": created, "skipped": skipped}

    def _import_payroll(
        self, source: _Source, tenant: Tenant, employees: dict, counts: dict
    ) -> None:
        created = updated = skipped = 0
        float_fields = (
            "ot_hours",
            "basic_earned",
            "da_earned",
            "hra_earned",
            "medical_allowance",
            "conveyance_allowance",
            "nfh_wages",
            "ot_earned",
            "leave_wages",
            "bonus_earned",
            "arrear",
            "gross_salary",
            "pf_deduction",
            "esi_deduction",
            "professional_tax",
            "lwf",
            "advance_deduction",
            "damage_deduction",
            "other_deductions",
            "total_deductions",
            "expense_reimbursement",
            "net_salary",
        )
        int_fields = (
            "present_days",
            "leave_days",
            "holiday_days",
            "holiday_working_days",
            "week_off_days",
            "total_paid_days",
            "absent_days",
        )

        for row in source.rows("payroll"):
            employee = employees.get(row.get("employee_id"))
            if employee is None:
                skipped += 1
                continue
            defaults = {field: row.get(field) or 0 for field in int_fields}
            defaults.update({field: row.get(field) or 0.0 for field in float_fields})
            _, was_created = Payroll.objects.update_or_create(
                tenant=tenant,
                employee=employee,
                year=row["year"],
                month=row["month"],
                defaults=defaults,
            )
            created += was_created
            updated += not was_created
        counts["payroll"] = {"created": created, "updated": updated, "skipped": skipped}

    # ---------------------------------------------------------------- output

    def _report(self, counts: dict, commit: bool) -> None:
        header = "Imported" if commit else "Would import (dry run — nothing was written)"
        self.stdout.write(self.style.MIGRATE_HEADING(header))

        total = 0
        for table, tally in counts.items():
            parts = ", ".join(f"{value} {key}" for key, value in tally.items() if value)
            total += sum(v for k, v in tally.items() if k != "skipped")
            self.stdout.write(f"  {table}: {parts or 'nothing'}")

        if total == 0:
            self.stdout.write(
                self.style.WARNING(
                    "\nNothing to import — the source has no HR business rows. If you expected "
                    "data, check that --source points at the deployed database rather than a "
                    "local dev copy."
                )
            )
        elif not commit:
            self.stdout.write(self.style.WARNING("\nRe-run with --commit to write these rows."))
        else:
            self.stdout.write(
                self.style.SUCCESS("\nDone. Safe to re-run — matching is idempotent.")
            )

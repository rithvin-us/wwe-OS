"""Employee — the HR master record.

Migrated from the legacy AutoSync HR app's `Employee` model
(docs/specs/hr-migration.md). Field names, defaults and enum *string values*
are preserved: those strings are written into statutory registers and travel
on the attendance-grid wire format, so they are part of the contract, not a
style choice.

Distinct from the platform's `users.User`: User is identity (who can sign in),
Employee is HR business data (who is on the rolls) — `docs/modules/hr.md` § 3.

IMPORTANT: employees are never hard-deleted. When one leaves, set
`date_of_leaving` and `status = "Left"` so history stays intact for a labour
inspection. The platform's soft-delete default already refuses hard deletes.
"""

from __future__ import annotations

from datetime import date

from django.db import models
from shared.models import TenantOwnedModel


class EmployeeStatus(models.TextChoices):
    ACTIVE = "Active", "Active"
    LEFT = "Left", "Left"
    NEW_JOINING = "New Joining", "New joining"


class SkillCategory(models.TextChoices):
    """Skill classification for Form D (Equal Wages Register)."""

    SKILLED = "Skilled", "Skilled"
    SEMI_SKILLED = "Semi Skilled", "Semi skilled"
    UNSKILLED = "Unskilled", "Unskilled"


class Employee(TenantOwnedModel):
    employee_code = models.CharField(max_length=20, db_index=True)
    employee_name = models.CharField(max_length=100)
    father_husband_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, default="M")
    dob = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=15, blank=True)
    designation = models.CharField(max_length=50, default="Operator")
    department = models.CharField(max_length=50, blank=True)
    date_of_joining = models.DateField()
    date_of_leaving = models.DateField(null=True, blank=True)

    # Money is stored as float, not Decimal, on purpose. The migrated payroll
    # engine's verified arithmetic (math.ceil on PF/ESI, round(x, 2) on every
    # component) is float arithmetic; switching to Decimal would silently move
    # paise and break the ported parity tests. See hr-migration.md § 3.
    salary = models.FloatField(default=0.0)

    # Statutory identifiers. Blank (not null) so the engine's truthiness
    # checks — `if employee.pf_number or employee.uan` — behave identically.
    pf_number = models.CharField(max_length=50, blank=True)
    uan = models.CharField(max_length=20, blank=True)
    esic_number = models.CharField(max_length=20, blank=True)

    bank_name = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=30, blank=True)
    ifsc_code = models.CharField(max_length=15, blank=True)

    status = models.CharField(
        max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE
    )
    skill_category = models.CharField(
        max_length=20, choices=SkillCategory.choices, default=SkillCategory.SEMI_SKILLED
    )
    location = models.CharField(max_length=50, default="Coimbatore")

    # Default shift: G/M/E/N — see hr.backend.services.shift_rules. The shift
    # actually worked is recorded per day on Attendance and overrides this.
    shift = models.CharField(max_length=2, default="G")

    # Self-service attendance enrolment. `face_embedding` holds a JSON-encoded
    # face template produced by hr.backend.services.face_recognition; it stays
    # blank until an operator enrols the employee. The raw reference image is
    # never stored.
    face_embedding = models.TextField(blank=True)
    enrolled_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_employee"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "employee_code"], name="uniq_employee_code_per_tenant"
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "date_of_joining"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_code} · {self.employee_name}"

    @property
    def is_active(self) -> bool:
        """Whether the employee is currently on the rolls (has not left)."""
        return self.status != EmployeeStatus.LEFT and self.date_of_leaving is None

    @property
    def age(self) -> int | None:
        """Computed from DOB on read, so it can never go stale."""
        if not self.dob:
            return None
        today = date.today()
        return (
            today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))
        )

    @property
    def age_gender_display(self) -> str:
        """Formatted as Form XXVI expects it: '26/M'."""
        age_val = self.age or ""
        return f"{age_val}/{self.gender}" if age_val else self.gender

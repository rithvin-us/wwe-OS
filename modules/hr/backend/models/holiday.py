"""Holiday — the paid-holiday calendar.

Migrated from the legacy app's `Holiday`. Read by the payroll engine (holidays
on the rolls are paid at the daily rate) and by the compliance forms
(Form VI, Form XXVI).
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class HolidayType(models.TextChoices):
    NATIONAL = "National", "National"
    FESTIVAL = "Festival", "Festival"
    WEEKLY_OFF = "Weekly Off", "Weekly off"


class Holiday(TenantOwnedModel):
    date = models.DateField()
    name = models.CharField(max_length=100)
    type = models.CharField(
        max_length=20, choices=HolidayType.choices, default=HolidayType.NATIONAL
    )
    year = models.PositiveIntegerField()

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_holiday"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "date"], name="uniq_holiday_date_per_tenant"),
        ]
        indexes = [models.Index(fields=["tenant", "year"])]

    def __str__(self) -> str:
        return f"{self.date}: {self.name} ({self.type})"

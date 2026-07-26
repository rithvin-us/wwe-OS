"""PunchLog — the immutable trail of every self-service check-in attempt.

Migrated from the legacy app's `AttendancePunchLog`.

Mirrors the attendance module's "raw data is the source of truth" principle: the
daily attendance row is derived, but every punch — with its face score, geo fix
and decision — is preserved here so fraud is detectable and a decision can be
explained after the fact.

Kept separate from the attendance table on purpose: a flagged or rejected punch
writes a log row but NOT an attendance row.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class PunchDecision(models.TextChoices):
    AUTO_APPROVED = "auto_approved", "Auto approved"
    FLAGGED = "flagged", "Flagged for review"
    REJECTED = "rejected", "Rejected"


class PunchDirection(models.TextChoices):
    IN = "in", "In"
    OUT = "out", "Out"


class PunchLog(TenantOwnedModel):
    # Nullable: an unrecognised face is still logged, so repeated failed
    # attempts are visible.
    employee = models.ForeignKey(
        "hr.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="punch_logs",
    )

    captured_at = models.DateTimeField()
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    geo_accuracy_m = models.FloatField(null=True, blank=True)
    within_geofence = models.BooleanField(default=False)
    face_match_score = models.FloatField(null=True, blank=True)

    direction = models.CharField(
        max_length=3, choices=PunchDirection.choices, blank=True, default=""
    )
    decision = models.CharField(max_length=20, choices=PunchDecision.choices)

    class Meta(TenantOwnedModel.Meta):
        db_table = "hr_punch_log"
        indexes = [
            models.Index(fields=["employee", "captured_at"]),
            models.Index(fields=["tenant", "decision"]),
        ]

    def __str__(self) -> str:
        return f"punch({self.employee_id}, {self.decision}, {self.direction})"

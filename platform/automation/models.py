"""Automation engine storage: a rule (what to collect, on what schedule, to
where) and its run history (exactly what happened each time it fired).

`AutomationRun` is deliberately itemized (`items`, not just a count) — a run
can end up handing bills or contracts to an outside auditor, so "what left
the building" has to be reconstructable after the fact, the same way
`AuditLog` makes every other action reconstructable. Runs also outlive their
rule (`rule` is nullable, `rule_name` is a snapshot) so deleting a rule never
erases what it already did.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class Cadence(models.TextChoices):
    ONCE = "once", "Once"
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"


class Destination(models.TextChoices):
    DOWNLOADED_PACKAGE = "downloaded_package", "Downloaded package"
    GENERATE_REPORT = "generate_report", "Generate report"
    AUDITOR_FOLDER = "auditor_folder", "Auditor folder"
    EMAIL = "email", "Email"
    CLOUD_STORAGE = "cloud_storage", "Cloud storage"


# Destinations with no delivery mechanism yet — a rule can be saved with one
# of these (so the operator can set it up ahead of time) but never run.
STUB_DESTINATIONS = frozenset({Destination.EMAIL, Destination.CLOUD_STORAGE})

# Destinations that bundle actual files (as opposed to running a report).
FILE_DESTINATIONS = frozenset({Destination.DOWNLOADED_PACKAGE, Destination.AUDITOR_FOLDER})


class RunStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class TriggerType(models.TextChoices):
    SCHEDULE = "schedule", "Schedule"
    MANUAL = "manual", "Manual"


class AutomationRule(TenantOwnedModel):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")

    # Which modules to pull tagged records from — irrelevant for
    # destination=generate_report, which runs an existing report instead.
    source_modules = models.JSONField(default=list, blank=True)

    # Tag ids that scope what qualifies. Required and non-empty (enforced in
    # AutomationService) — a rule never collects "everything untagged" by
    # default, since the whole point is the operator curating exactly what a
    # package contains before it can leave the company.
    required_tags = models.JSONField(default=list, blank=True)

    destination = models.CharField(max_length=30, choices=Destination.choices)
    report_key = models.CharField(
        max_length=100, blank=True, default="", help_text="Required when destination is a report."
    )
    export_format = models.CharField(max_length=10, default="csv")

    cadence = models.CharField(max_length=10, choices=Cadence.choices, default=Cadence.ONCE)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "automation_rule"
        indexes = [models.Index(fields=["tenant", "is_active", "next_run_at"])]

    def __str__(self) -> str:
        return self.name


class AutomationRun(TenantOwnedModel):
    rule = models.ForeignKey(
        AutomationRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="runs"
    )
    rule_name = models.CharField(max_length=200)
    destination = models.CharField(max_length=30)
    status = models.CharField(max_length=10, choices=RunStatus.choices)
    triggered_by = models.CharField(
        max_length=10, choices=TriggerType.choices, default=TriggerType.SCHEDULE
    )

    started_at = models.DateTimeField()
    finished_at = models.DateTimeField()

    item_count = models.IntegerField(default=0)
    # [{"module", "object_type", "object_id", "title", "included"}, ...] —
    # every record the rule matched, and whether its file made it into the
    # package (a matched-but-not-included row means the file was missing,
    # not that it was silently dropped).
    items = models.JSONField(default=list, blank=True)

    output_file = models.ForeignKey(
        "storage.StoredFile", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    report_export = models.ForeignKey(
        "reporting.ReportExport", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    error_message = models.TextField(blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # Links to the workflow.PipelineRun that produced this row. Nullable and
    # not exposed in AutomationRunSerializer — purely internal, keeps the
    # existing frontend contract unchanged.
    pipeline_run = models.ForeignKey(
        "workflow.PipelineRun", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "automation_run"
        indexes = [models.Index(fields=["tenant", "rule", "created_at"])]

    def __str__(self) -> str:
        return f"{self.rule_name} · {self.status}"

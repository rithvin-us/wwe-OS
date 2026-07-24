"""Registers automation's rule-execution behavior as pipelines on the
generic workflow engine (platform/workflow). Step bodies stay owned by
AutomationService — this module holds only thin adapters, so business logic
isn't split across two files.

Each pipeline is a single step, not artificially split into more: see the
note in docs/superpowers/plans/2026-07-24-pipeline-execution-engine.md
Task 12 for why (PipelineRun.context is JSON-only; today's collect+zip+store
has no natural JSON-safe boundary to split across).
"""

from __future__ import annotations

from django.utils import timezone
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)

PACKAGE_PIPELINE_KEY = "automation.rule_execution.package"
REPORT_PIPELINE_KEY = "automation.rule_execution.report"


def _run_collect_and_package(ctx: StepContext) -> StepResult:
    from automation.models import AutomationRule
    from automation.services import AutomationService

    rule = AutomationRule.objects.get(id=ctx.data["rule_id"])
    items, output_file = AutomationService()._collect_and_package(
        rule=rule, started=timezone.now(), actor=ctx.actor
    )
    return StepResult(
        output={
            "items": items,
            "output_file_id": str(output_file.id) if output_file else None,
        }
    )


def _run_report(ctx: StepContext) -> StepResult:
    from reporting.services import ReportService

    from automation.models import AutomationRule

    rule = AutomationRule.objects.get(id=ctx.data["rule_id"])
    report_export = ReportService().run(
        key=rule.report_key,
        format=rule.export_format or "csv",
        filters={"tag_ids": rule.required_tags},
        tenant=ctx.tenant,
        actor=ctx.actor,
    )
    return StepResult(
        output={
            "report_export_id": str(report_export.id),
            "items": [
                {
                    "module": "reporting",
                    "object_type": "ReportExport",
                    "object_id": str(report_export.id),
                    "title": report_export.title,
                    "included": True,
                }
            ],
        }
    )


def register_pipelines() -> None:
    register_pipeline(
        PipelineDefinition(
            key=PACKAGE_PIPELINE_KEY,
            label="Collect and package tagged records",
            module="automation",
            permission="automation.run",
            version=1,
            steps=[
                StepDefinition(
                    key="collect_and_package",
                    label="Collect & package",
                    run=_run_collect_and_package,
                    max_attempts=2,
                )
            ],
        )
    )
    register_pipeline(
        PipelineDefinition(
            key=REPORT_PIPELINE_KEY,
            label="Generate a report",
            module="automation",
            permission="automation.run",
            version=1,
            steps=[
                StepDefinition(
                    key="run_report", label="Run report", run=_run_report, max_attempts=2
                )
            ],
        )
    )

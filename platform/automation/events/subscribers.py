"""Wires the generic pipeline engine's completion/cancellation events into
automation's legacy AutomationRun record — the one the current /automation
frontend reads. workflow/ has no knowledge AutomationRun exists; this
subscriber is where that meaning lives, the same separation every future
pipeline consumer will keep.
"""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe

from automation.pipelines import PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY


def _on_pipeline_finished(event: str, instance: Any = None, **_extra: Any) -> None:
    run = instance
    if run is None or run.pipeline_key not in (PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY):
        return

    from workflow.models import PipelineRunStatus

    from automation.models import AutomationRule, RunStatus
    from automation.services import AutomationService

    rule = AutomationRule.objects.filter(id=run.source_object_id).first()
    if rule is None:
        return  # rule was deleted between start and finish — nothing left to record against

    step = run.steps.order_by("step_index").first()
    items: list[dict[str, Any]] = []
    output_file = None
    report_export = None

    if run.status == PipelineRunStatus.SUCCESS and step is not None:
        output = step.output
        items = output.get("items", [])
        if output.get("output_file_id"):
            from storage.models import StoredFile

            output_file = StoredFile.objects.filter(id=output["output_file_id"]).first()
        if output.get("report_export_id"):
            from reporting.models import ReportExport

            report_export = ReportExport.objects.filter(id=output["report_export_id"]).first()

    status = RunStatus.SUCCESS if run.status == PipelineRunStatus.SUCCESS else RunStatus.FAILED
    error = run.error_message or ("Cancelled." if run.status == PipelineRunStatus.CANCELLED else "")
    finished = run.finished_at or run.queued_at

    AutomationService()._record_run(
        rule=rule,
        status=status,
        triggered_by=run.trigger_type,
        started=run.started_at or run.queued_at,
        finished=finished,
        items=items,
        output_file=output_file,
        report_export=report_export,
        error=error,
        actor=run.triggered_by,
        pipeline_run=run,
    )
    AutomationService()._advance_schedule(rule=rule, finished=finished)


subscribe(Events.WORKFLOW_COMPLETED, _on_pipeline_finished)
subscribe(Events.WORKFLOW_CANCELLED, _on_pipeline_finished)

"""Finance's background work registered on the generic workflow engine
(`platform/workflow`), the same pattern as `automation.pipelines`.

Reading a bulk-uploaded invoice scan is one such job: it calls a slow external
model and must survive a crash, so it runs as a one-step pipeline drained by the
`pipeline_tick` command rather than inline in the upload request. The step body
stays in `InvoiceImportService`; this file is only the thin adapter that binds it
to the engine (imported lazily so `ready()` never touches the database).
"""

from __future__ import annotations

from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    register_pipeline,
)

INVOICE_IMPORT_OCR_PIPELINE_KEY = "finance.invoice_import.ocr"


def _run_extract(ctx: StepContext) -> StepResult:
    from finance.backend.services.invoice_import import InvoiceImportService

    outcome = InvoiceImportService().run_extraction(
        item_id=ctx.data["item_id"], tenant=ctx.tenant, attempt=ctx.attempt
    )
    return StepResult(output=outcome or {})


def register_pipelines() -> None:
    register_pipeline(
        PipelineDefinition(
            key=INVOICE_IMPORT_OCR_PIPELINE_KEY,
            label="Read an uploaded invoice scan",
            module="finance",
            permission="finance.invoice.import",
            version=1,
            steps=[
                StepDefinition(
                    key="extract",
                    label="Extract invoice fields (OCR)",
                    run=_run_extract,
                    # One re-attempt for an infra hiccup; kept in step with
                    # InvoiceImportService.MAX_OCR_ATTEMPTS. OCR itself degrades
                    # rather than raising, so a low-confidence read is a success
                    # that lands in review, not a retry.
                    max_attempts=2,
                )
            ],
        )
    )

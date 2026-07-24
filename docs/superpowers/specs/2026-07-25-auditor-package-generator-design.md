# Auditor Package Generator — Design

**Status:** Approved 2026-07-24 (Business Operations Orchestrator roadmap) — implementation in progress.
**Scope:** Subsystem 9. For a given business period, collect every PDF `StoredFile` of a given document type, merge into one file, store it back into that period's `Auditor` folder.

## 1. Context

Everything this needs already exists except PDF merging: `platform/periods` resolves the `Auditor` folder path and tracks the period; `platform/storage` reads/writes bytes; `platform/workflow` runs a retryable, observable pipeline. No PDF-merge library exists in this repo — `reportlab` (already a dependency, used by `reporting`) _generates_ PDFs, it doesn't merge existing ones. `pypdf` added (approved) for exactly this.

## 2. Design

**a) Entirely a platform capability — no module import needed.** Collecting "every Invoice PDF" / "every Purchase Bill PDF" for a period is a `StoredFile.objects.filter(category=..., period_year=..., period_month=...)` query — `category` and `period_year`/`period_month` are platform-owned fields (Subsystem 2), already populated identically by both `documents` (any `invoice`-category upload) and `purchase` (every ingested bill, `category="purchase_bill"` since Subsystem 4). `platform/auditor` never imports `documents`/`purchase` — it operates purely on `StoredFile`, same as `platform/search`'s adapters operate on business models rather than the reverse.

**b) `Auditor` is a new rotating document type in the `periods` registry**, `folder_segment="Auditor"`, `is_library=False` — the roadmap explicitly listed it as one of the standard per-month folders (alongside Invoices, Purchase Bills, Reports, HR, Logs) back when the two storage domains were designed (Subsystem 2); it was registered as a reserved, unfilled folder then. This subsystem is its first real producer.

**c) A two-step pipeline on the existing engine, not a bespoke script.** `platform/workflow` (Subsystem 1) already provides retries, crash recovery, and observable run/step history — building a second execution mechanism here would be exactly the duplication that engine exists to prevent. Two steps, one per document type: `merge_invoices`, `merge_purchase_bills`. Each step is self-contained (collect → merge → store) rather than split further, because `PipelineStepRun.output`/`context` are JSON — raw PDF bytes cannot cross a step boundary, so "collect" and "merge+store" have to happen together in the same step regardless of how many steps exist; the real retry benefit (one document type's failure doesn't affect the other's already-succeeded step) is preserved with two steps.

**d) Missing files degrade, they don't fail the run.** An empty period (no invoices yet) produces `{"generated": False, "reason": "no_files"}` for that step, not a pipeline failure — "no manual collection" doesn't mean "every period must always produce a package." A non-PDF `StoredFile` (e.g. a photographed bill stored as `image/jpeg` — `purchase`'s Telegram channel can produce these) is skipped from the merge with a note in the step's `output`, not converted — image-to-PDF conversion is a second, separate capability (a new dependency, e.g. Pillow/img2pdf) not covered by this approval; skipped files are visible in the step's output for an operator to notice, not silently dropped without a trace.

**e) Idempotent by period.** Re-running the pipeline for the same `(tenant, year, month)` is expected (an invoice arrives late, the operator regenerates) — the merged output's `key` is deterministic per period+type (`resolve_location`'s existing collision-suffix behavior in `StorageService.store` still applies if an identical key already exists, producing `Invoices-July-2026-2.pdf` rather than overwriting — consistent with every other document in this system; nothing here special-cases "auditor packages get overwritten").

**f) Manual trigger only, for now.** `AuditorService.generate_package(tenant, year, month, actor)` starts and drains the pipeline synchronously (same `PipelineService.start()` + `run_to_completion()` pattern automation's `run_rule()` uses) via a new `POST /api/v1/auditor/packages/generate/` endpoint, gated by a new `auditor.generate` permission. No scheduled/automatic monthly trigger — that's an `automation` rule a human sets up later if wanted (this subsystem provides the pipeline `automation` could target, not a cron of its own — avoids duplicating automation's existing scheduling).

## 3. Out of scope

Image-to-PDF conversion; a scheduled/automatic monthly trigger; a dedicated read API for "list generated packages" (the existing `periods` API's `recent_uploads` and `search` already surface any `StoredFile`, including these, once indexed — no new read surface needed); more document types than Invoices/Purchase Bills (the roadmap's two named examples) — the pipeline/registry pattern here extends to a third type later without a redesign.

## 4. Test plan

- `test_auditor_pdf.py` — `merge_pdfs`: merging two valid single-page PDFs produces a PDF with both pages; merging zero inputs raises (caller's job to check `file_ids` is non-empty first, not the merge function's).
- `test_auditor_pipeline.py` — the two-step pipeline: invoices-only period produces an `Invoices-*.pdf` and a `{"generated": False}` purchase-bills step; both present produces both; a non-PDF `StoredFile` in the mix is skipped and noted, the PDF ones still merge; re-running for the same period produces a second, distinctly-keyed file (no overwrite); the merged file's `category="auditor_package"`, `period_year`/`period_month` match the requested period, `is_library=False`.
- `test_auditor_api.py` — `POST .../generate/` starts and returns a completed `PipelineRun` (reusing `workflow.serializers.PipelineRunSerializer` — no new run-representation invented), gated by `auditor.generate`, tenant-scoped.

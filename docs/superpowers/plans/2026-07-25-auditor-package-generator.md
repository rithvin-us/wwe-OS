# Auditor Package Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** `platform/auditor` — `merge_pdfs()`, a two-step `workflow` pipeline (`merge_invoices`, `merge_purchase_bills`), and a manual-trigger API. Reuses `periods`/`storage`/`workflow` entirely; no module import.

**Architecture:** See `docs/superpowers/specs/2026-07-25-auditor-package-generator-design.md`.

## Global Constraints

- Gate per task: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- No changes needed to `documents`/`purchase` — this subsystem reads `StoredFile` directly (design §2a).
- `pypdf` is a new dependency (approved) — added to `platform/requirements.txt`, installed.
- No image-to-PDF conversion, no scheduled trigger (design §3).
- Known, pre-existing, unrelated failure: `test_contracts.py::test_expiry_scan_expires_and_reminds` — not this plan's regression.
- Small commits: one per task.

## Milestones

| #   | Milestone                       | Tasks | Exit criteria                                                        |
| --- | ------------------------------- | ----- | -------------------------------------------------------------------- |
| M1  | App + PDF merge + document type | 1     | `merge_pdfs()` tested standalone, `Auditor` document type registered |
| M2  | Pipeline                        | 2     | two-step pipeline registered and tested via `workflow` directly      |
| M3  | Service + API                   | 3     | `AuditorService.generate_package`, `POST .../generate/` live         |
| M4  | Production-quality gate         | 4     | full gate green, committed                                           |

---

### Task 1: App skeleton, PDF merge, `Auditor` document type, permission

**Files:** `platform/auditor/{__init__.py,apps.py,pdf.py}`, `platform/tests/test_auditor_pdf.py`. Modify `platform/config/settings.py`, `platform/permissions/registry.py`, `platform/requirements.txt`.

- [ ] `pip install pypdf`, add to `requirements.txt`.
- [ ] `AuditorConfig` (name="auditor"), added to `PLATFORM_APPS_BEFORE_MODULES` after `"rules"`; `ready()` registers the `auditor_package` `DocumentTypeDef` (`folder_segment="Auditor"`, `is_library=False`) with `periods.registry`.
- [ ] `pdf.py`: `merge_pdfs(streams: list[bytes]) -> bytes` (pypdf `PdfWriter`), raises `ValueError` on an empty list.
- [ ] `PermissionDef("auditor.generate", "Generate an auditor package for a business period", "Auditor")`.
- [ ] Failing tests (merge two real minimal PDFs, assert 2-page result; empty list raises) → implement → green.
- [ ] Full verify. Commit.

### Task 2: Pipeline — `merge_invoices` / `merge_purchase_bills`

**Files:** `platform/auditor/pipelines.py` (registered in `apps.ready()`), `platform/tests/test_auditor_pipeline.py`.

**Acceptance criteria:** each step queries `StoredFile.objects.filter(tenant=, category=<type>, period_year=, period_month=, content_type="application/pdf")`, merges via `merge_pdfs`, resolves a key via `periods.resolution.resolve_location` (`document_type="auditor_package"`, `business_date=date(year, month, 1)`, `document_name=f"{Label}-{MonthName}-{Year}.pdf"`), stores via `StorageService.store(category="auditor_package", ...)`, records via `PeriodService.record_document`; zero matching files → `StepResult(output={"generated": False, "reason": "no_files"})`, not a failure; non-PDF `StoredFile`s in the same category+period are excluded from the query (by `content_type`) and don't error.

- [ ] Failing tests (invoices-only, both types, empty period, re-run produces a second distinctly-keyed file — collision suffix from `StorageService`, Subsystem 2, already handles this with zero new code) → implement `pipelines.py` (`AUDITOR_PACKAGE_PIPELINE_KEY`, two `StepDefinition`s, `register_pipeline`) → green.
- [ ] Full verify. Commit.

### Task 3: `AuditorService` + manual-trigger API

**Files:** `platform/auditor/services.py`, `platform/auditor/views.py`, `platform/auditor/urls.py`, `platform/tests/test_auditor_api.py`. Modify `platform/config/urls.py`.

- [ ] `AuditorService.generate_package(*, tenant, year, month, actor=None) -> PipelineRun` — `PipelineService().start(pipeline_key=AUDITOR_PACKAGE_PIPELINE_KEY, tenant=, input_data={"year": year, "month": month}, source_module="auditor", source_object_type="BusinessPeriod", trigger_type="manual")` then `run_to_completion()`.
- [ ] `POST /api/v1/auditor/packages/generate/` (body `{"year": int, "month": int}`) — plain `APIView`, `required_permissions = "auditor.generate"`, returns `workflow.serializers.PipelineRunSerializer(run).data` (reused, not reinvented).
- [ ] Failing tests → implement → green.
- [ ] Full verify. Commit.

### Task 4: Final verification

- [ ] `pytest -q` (contracts flake excluded, noted), `manage.py check`, `ruff check platform`, `ruff format --check platform`.
- [ ] `pnpm --filter web build` unchanged.
- [ ] Commit if formatting needed a fix.

## Migration plan

None — `platform/auditor` has no models of its own (it writes `StoredFile`/`BusinessPeriod`/`PipelineRun` rows through existing services).

## Rollback considerations

New, unreferenced app until wired into `INSTALLED_APPS`/`urls.py`; reverting is a plain `git revert`. The `pypdf` dependency can be removed in the same revert if this subsystem is ever fully rolled back — nothing else in the codebase uses it (verified: `reportlab` is the only existing PDF-touching dependency, used for generation, not merging, by an unrelated capability).

## Regression risks

| Risk                                                                                                | Mitigation                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A very large period (hundreds of invoices) makes the merge step slow or memory-heavy                | Out of scope to optimize preemptively — no current data volume justifies it (single-operator company); revisit if it's ever actually slow                                                                                                                                              |
| A corrupt/malformed `StoredFile` claiming `content_type="application/pdf"` breaks `pypdf` mid-merge | The step catches a merge exception per design's "one bad thing doesn't stop the sweep" precedent (same pattern `reclaim_stale_steps`/`automation.run_due` already use) — a broken file fails that step (retryable) without corrupting the other document type's already-succeeded step |

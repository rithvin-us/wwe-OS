# Spec — Bulk historical invoice import (OCR)

Status: **Planned → In progress.** Owner module: `finance` (the Invoicing slice).
Last updated: 2026-08-29.

## 1. Context — why this exists

The company adopted WWE OS partway through the financial year. 30–40 **outgoing**
invoices (company-issued AMC/Sales bills in the `G/M/<seq>/<FY>` series) were
already raised on paper / in the old system before the register went live. They
have to land in the bill register so the register, the Executive Dashboard
revenue KPIs (`/finance/invoices/stats`) and any statutory export reflect the
**whole** year, not just the invoices raised inside the platform.

Doing that one-at-a-time through the existing `GenerateInvoiceDialog` is wrong on
three counts: it would allocate *fresh* numbers (breaking the real printed
sequence), it captures nothing from the physical document, and it does not scale
to 40 scans. This feature adds a **bulk upload → OCR → review/correct → commit**
path that preserves each invoice's printed number, keeps the original scan for
analytics, and continues the live number series correctly afterward.

### Confirmed decisions (from the operator, 2026-08-29)

| Question | Decision | Consequence |
| --- | --- | --- |
| Issued or received? | **Outgoing** (we issued them) | Builds into `finance` (Invoicing), not `purchase`. |
| Numbering | **Preserve printed numbers, continue the series** | Import writes the exact printed number; the counter reconciles to `max`. |
| Processing | **Async pipeline** | Reuse `platform/workflow`; files upload instantly, OCR drains in background. |
| Stored copy | **Scan + regenerate system PDF/workbook** | Commit stores the scan *and* renders the standard xlsx/PDF. |

## 2. Non-negotiable constraints honored

- **Integrate into the existing module.** No new module; everything lands in
  `modules/finance/backend` + the `invoices` frontend slice.
- **No module calls a provider directly** (CLAUDE.md rule 3). OCR goes through
  `platform/ai` `AIService`. Finance gets its **own** `InvoiceOCRService`
  (modules never import each other — so it does not import `purchase`'s).
- **Numbering integrity is sacred.** The DB unique constraints on
  `(tenant, number)` and `(tenant, financial_year, sequence_number)` and the
  soft-delete-aware `max(counter, highest_saved)+1` rule are the backstop; the
  import path must not weaken them.
- **Design Bible + one-shell UI:** `@bop/ui`, tokens only, `PageHeader`,
  `(platform)` layout, no emoji, mobile-first.
- **No fake data.** Confidence, extracted values and blanks are shown honestly.

## 3. Architecture & data flow

```
upload N scans ──► InvoiceImportService.create_batch()
                     │  store each scan (platform/storage, sha256 dedupe)
                     │  create InvoiceImportItem(status=queued)
                     │  PipelineService.start("finance.invoice_import.ocr",
                     │        idempotency_key=sha256, input={item_id})
                     ▼
              (returns batch immediately — non-blocking)

pipeline_tick (scheduler) ──► advance_one ──► _run_extract(ctx)
                     │  InvoiceOCRService.extract_from_image(scan)  ── platform/ai ──► Gemini vision
                     │  map extraction → draft, match customer
                     │  item.status = extracted | needs_attention
                     ▼
           operator opens /invoices/import/[batchId]
                     │  review grid: confidence, editable number/date/customer/lines
                     │  PATCH draft → server recomputes totals (computation.py)
                     ▼
           commit ──► InvoiceService.import_historical()
                     │  parse printed number → (seq, FY); validate vs date FY
                     │  create Invoice(source=imported, exact number/seq/FY)
                     │  InvoiceNumberingService.reconcile(seq)   ← counter jumps past it
                     │  regenerate xlsx + PDF (_attach_documents); link scan (source_file)
                     ▼
             register row + dashboard revenue now include the import
```

## 4. Data model

New file `modules/finance/backend/models/invoice_import.py`; migration `0004`.

### `InvoiceImportBatch(TenantOwnedModel)` — table `finance_invoice_import_batch`
- `label` CharField — operator label, defaults to "Historical import <date>".
- `status` — `processing | review | completed | archived` (coarse lifecycle
  hint; per-item truth lives on the items and counts are computed).
- `created_by` FK → user (SET_NULL).

### `InvoiceImportItem(TenantOwnedModel)` — table `finance_invoice_import_item`
- `batch` FK → InvoiceImportBatch (`related_name="items"`, CASCADE).
- `source_file` FK → `storage.StoredFile` (PROTECT) — the original scan.
- `original_filename` CharField; `content_hash` CharField(64, db_index) — sha256.
- `status` — `queued | processing | extracted | needs_attention | committed | failed | discarded`.
- `raw_extraction` JSONField(default=dict) — **immutable** full OCR payload (audit/reprocess).
- `proposed` JSONField(default=dict) — **operator-editable** draft matching the
  `GenerateInvoiceSerializer` shape **plus** `number`. Seeded from OCR.
- Denormalized-for-query (kept in sync when `proposed` changes): `proposed_number`
  CharField, `proposed_invoice_date` DateField(null), `proposed_total`
  Decimal(14,2), `confidence_score` Decimal(4,3, default 0).
- `error_message` TextField(blank); `run_id` CharField(blank) — the pipeline run.
- `invoice` FK → Invoice (SET_NULL, null) — set on commit.
- Uniqueness: `(tenant, batch, content_hash)` where not deleted — re-running a
  batch upload can't duplicate a file.

### `Invoice` additions (small, deliberate)
- `source` — new `InvoiceSource` TextChoices `generated | imported` (default
  `generated`, `db_index`).
- `source_file` FK → `storage.StoredFile` (SET_NULL, null) — the original scan
  for imported invoices (the "copy for analytics"). Served at
  `/invoices/{id}/source/`; exposed as `source_url` on `InvoiceSerializer`.

`InvoiceLine`, the numbering models and constraints are unchanged.

## 5. Numbering preservation (the core correctness piece)

`modules/finance/backend/services/numbering.py`:
- `parse_invoice_number(number) -> (sequence_number, financial_year)` — parses
  from the right: last `/`-segment is `YYYY-YY`, the segment before it is the
  integer sequence. Validates the FY shape and a positive int; raises
  `ValidationError` otherwise (the operator then fixes the number in the grid).
- `InvoiceNumberingService.reconcile(*, tenant, financial_year, sequence_number)`
  — under the same `SELECT FOR UPDATE` lock as `reserve()`, sets
  `last_number = max(last_number, sequence_number)`. Idempotent.

`InvoiceService.import_historical(...)`:
1. `_prepare(...)` for lines/tax/totals/snapshots (reused verbatim).
2. `parse_invoice_number(number)` → `(seq, fy)`; assert
   `fy == financial_year_for(invoice_date)` (guards an OCR-misread date/number).
3. Reject if `(tenant, number)` or `(tenant, fy, seq)` already exists in
   `all_objects` → `ConflictError` (duplicate import).
4. `Invoice.objects.create(source=IMPORTED, number=number, sequence_number=seq,
   financial_year=fy, ...)`; `_write_lines`; `_attach_documents` (regenerates
   xlsx+PDF); link `source_file`.
5. `InvoiceNumberingService().reconcile(seq)` inside the same transaction — the
   counter can never re-hand a number ≤ an imported one, even under a race, and
   independently of the highest-saved scan.
6. **Period lock is bypassed for imports** (recording history, not raising new
   liability); the bypass is recorded in the audit entry
   `finance.invoice_imported`. Event `INVOICE_IMPORTED`.

## 6. OCR via the gateway

New `modules/finance/backend/services/invoice_ocr.py` `InvoiceOCRService`,
mirroring `PurchaseOCRService` but tuned for **our outgoing** invoices and living
in finance:
- `extract_from_image(image_bytes, *, mime_type, tenant, document_text="")` →
  `AIService().generate(module="finance", use_case="invoice-import-ocr-vision",
  system=VISION_PROMPT, model=AI_OCR_MODEL, max_tokens=AI_OCR_MAX_TOKENS,
  temperature=0.0, timeout=AI_OCR_TIMEOUT_SECONDS, images=[AIImage(...)])`.
- Extracts: `number` (our printed G/M number), `invoice_date`, `invoice_type`
  (amc/sales), `consignee_name`, `consignee_address`, `gstin`, `is_sez`,
  `gst_rate`, `period_month`/`period_year` (AMC), `lines[]`
  (`description/hsn/quantity/uom/rate`), totals, `confidence_score`,
  `unreadable_fields`. Honesty rules identical in spirit to purchase's.
- `map_to_draft(raw)` → the `proposed` dict; `match_customer(...)` by GSTIN then
  name against `CustomerRepository`.

Platform change (task 2): `AIService.generate` gains an optional
`timeout: int | None = None` param passed through to `AIRequest`
(defaults to `AI_TIMEOUT_SECONDS`). Dense multi-page invoices need the 180s OCR
budget, which is currently defined (`AI_OCR_TIMEOUT_SECONDS`) but ignored.
Backward-compatible; benefits purchase OCR too.

## 7. Async pipeline

New `modules/finance/backend/pipelines.py` registers
`finance.invoice_import.ocr` (permission `finance.invoice.import`, version 1) with
one step `extract` (`max_attempts=2`):
- loads the item, sets `processing`, `StorageService().open(source_file)`,
  `InvoiceOCRService().extract_from_image(...)`, maps → draft, syncs denormalized
  fields, sets `extracted` or `needs_attention` (confidence below
  `INVOICE_OCR_REVIEW_THRESHOLD` or missing number/date/total), saves.
- on exception: record `error_message`; re-raise while `ctx.attempt < max` (retry
  with backoff); on the last attempt set `failed` and return.

Registered from `FinanceConfig.ready()` via `register_pipelines()`. Drained by the
existing `pipeline_tick` management command (already scheduled in deployment).
`idempotency_key=sha256` makes re-runs safe. 40 calls « the 200/hr AI limit.

## 8. API surface (`/api/v1/finance/`)

Two viewsets in `api/import_views.py`, registered in `api/urls.py`:
- `invoice-imports` (`InvoiceImportBatchViewSet`):
  - `POST /` bulk upload — multipart `files[]` + `label`; creates batch+items,
    dedupes by sha256, starts a run per item; returns the batch. Perm
    `finance.invoice.import`.
  - `GET /`, `GET /{id}/` — batch list / detail (items + computed counts).
  - `POST /{id}/commit/` — commit every `extracted` item; returns a summary.
- `invoice-import-items` (`InvoiceImportItemViewSet`):
  - `PATCH /{id}/` — save the draft; server recomputes and returns totals.
  - `POST /{id}/recompute/` — totals for the current draft, saving nothing.
  - `POST /{id}/commit/` — `InvoiceService.import_historical(...)`; links the
    created invoice; returns it.
  - `POST /{id}/discard/` — mark `discarded`.

New permission `finance.invoice.import` in `permissions/registry.py`. New event
`INVOICE_IMPORTED` in `events/registry.py`.

## 9. Frontend (the `invoices` slice)

- `config/invoices.ts` — `ImportBatch`, `ImportItem`, `ImportItemStatus`, labels
  and badge variants, `IMPORT_*` URL helpers (client-safe, no server imports).
- `lib/invoices.ts` — `getInvoiceImports()`, `getInvoiceImport(id)` server
  fetchers via `djangoFetch`.
- Proxy routes attaching the bearer server-side (mirror the existing finance
  proxies): `app/api/finance/invoice-imports/route.ts` (POST/GET),
  `.../invoice-imports/[id]/route.ts`, `.../invoice-imports/[id]/commit/route.ts`,
  `app/api/finance/invoice-import-items/[id]/route.ts` (PATCH),
  `.../[id]/commit/route.ts`, `.../[id]/discard/route.ts`.
- UI: a **Bulk import** button in the invoices `PageHeader` opens a multi-file
  `<Dropzone multiple accept="image/*,.pdf">` upload dialog → POST → routes to
  `/invoices/import/[batchId]`. `/invoices/import` lists batches; the batch page
  is the **review/correction grid** — per row: filename, `ConfidenceRing`, status
  badge, editable `number`/date/customer(combobox)/type/gst rate, a line editor,
  live-recomputed totals, and commit/discard/view-scan actions. TanStack Query
  with `refetchInterval` while any item is `queued|processing`. Reuse the
  `ConfidenceRing` idea from `purchase-upload-card.tsx`.

## 10. Bugs reviewed (the operator asked)

1. **`app/api/finance/po-parse/route.ts` calls Gemini directly** — violates the
   platform-AI-gateway rule and duplicates OCR logic client-side with the API
   key on the web tier. **Fix:** add backend `POST /finance/invoices/parse-document/`
   using `InvoiceOCRService`; repoint the web route to proxy it and drop the
   direct provider call. `upload-po-dialog.tsx`'s response shape is preserved.
2. **`updateInvoiceStatusAction` (`invoices/actions.ts`) swallows failures and
   returns `{ok:true}`** for statuses (`approved/on_hold/declined`) the backend
   (`issued/cancelled` only) can't persist — silent data loss. **Fix:** stop
   misreporting success (return the real error); document the deeper
   status-model reconciliation as a follow-up (out of this feature's scope).
3. Any further defects found while implementing are logged here.

## 11. Testing

Backend (`modules/finance/backend/tests/`, `MockProvider`):
- OCR mapping → draft; customer match by gstin/name.
- sha256 dedupe within a batch; batch/item creation; pipeline run + idempotency.
- `parse_invoice_number` happy/edge; FY-vs-date mismatch rejected.
- `import_historical` preserves the printed number, reconciles the sequence so a
  subsequently *generated* invoice takes `max+1` (no collision), regenerates
  docs, links the scan, sets `source=imported`; duplicate import → 409; locked
  period is bypassed.
- Permissions: `finance.invoice.import` gates upload/commit.

Frontend (Vitest): proxy route bearer attach; review-grid recompute + commit
happy path.

## 12. CI/CD & deployment

- Gates to pass (per CLAUDE.md): `biome ci`, `pnpm --filter web lint`,
  `pnpm --filter web build`, `tsc --noEmit`, `pnpm --filter web test`,
  `ruff check .` + `ruff format --check .`, `python manage.py check`, `pytest`.
- Deployment: OCR uses the platform AI gateway → **no new service to deploy**.
  The async path needs `pipeline_tick` running (already scheduled). Required env
  in prod: `GEMINI_API_KEY`, `AI_OCR_MODEL`, `AI_OCR_TIMEOUT_SECONDS`,
  `STORAGE_*`. Documented in `.env.example` + `docs/deployment/backend.md`.

## 13. Sequencing

1. `AIService` timeout param. 2. Import models + migration. 3. `InvoiceOCRService`.
4. Import service + numbering + `import_historical`. 5. Pipeline. 6. API + perms +
events. 7. Backend tests. 8. Frontend config/lib/proxies. 9. Bulk-import UI.
10. Bug fixes. 11. Verify gates + deployment, commit, push.

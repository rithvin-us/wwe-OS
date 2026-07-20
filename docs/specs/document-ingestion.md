# Document Ingestion Platform

**Status: partially built.** The Telegram channel and the OCR→platform
pipeline for purchase bills are real and tested (Stage 2). Email ingestion,
generic (non-purchase) document classification, and search indexing are not
yet built. See `_shared-conventions.md` for error handling, security,
testing, and deployment — this document covers what's specific to ingestion.

## 1. Functional requirements

- Accept a document (image or PDF) from a channel (Telegram today; email,
  manual upload later).
- Extract structured fields from it via OCR/vision (today: seller name, date,
  total, currency — purchase-bill-shaped; future: generalize per document
  type).
- Hand the extracted data to the owning module (today: `modules/purchase`)
  for storage and human review.
- Never lose the original document: keep a reference to it, even before
  durable storage exists (today: a temporary channel-hosted URL, honestly
  labeled as temporary — see gap below).

## 2. Non-functional requirements

- Ingestion must never block on the receiving module being slow — the
  channel posts and moves on (already true: the bot POSTs once, retries on
  5xx, and gives the user an honest error if it can't save).
- No document uploaded by a user is ever silently discarded on error — every
  failure path tells the user what happened.
- Ingestion channels are rate-limited independently of human users (built:
  `IngestionRateThrottle`, `_shared-conventions.md` § Security).

## 3. Database schema

Ingestion itself has no schema of its own — it is a pipeline that produces
records in the owning module's schema (today: `purchase_bill`, see
`docs/specs/purchase.md`). A future generic `document` schema
(`docs/modules/dms.md`) will let non-purchase documents ingest without a
purchase-specific destination.

## 4. Entity relationships

```
Telegram message → (bot) OCR extraction → POST /api/v1/purchase/bills/ingest/
                                              → PurchaseBill (source_channel=telegram)
```

Future: `Email message → (email-service) → POST .../ingest/` targeting
whichever module the sender/subject routes to (not yet designed).

## 5. Folder structure

```
services/telegram-bot/       Built. main.py, requirements.txt, Dockerfile.
services/email-service/      Not built. README + empty scaffold only.
services/ocr/                Not built. Reserved for a dedicated OCR
                              microservice if/when volume outgrows an inline
                              vision-model call inside the bot.
platform/shared/service_auth.py   Built. Reusable ingestion authentication.
```

## 6. Backend architecture

Today's flow (built): `services/telegram-bot/main.py` — downloads the file,
calls an OpenAI vision model, POSTs the result to
`modules/purchase/backend/api/views.py::IngestBillView`, which delegates to
`PurchaseBillService.ingest()`.

This is deliberately a **channel does OCR, platform stores** split, not
"platform does OCR" — keeps the AI call co-located with the channel that has
the raw file, avoids uploading large binaries to the platform for no reason,
and matches the AI Layer's cost-conscious design (§ `ai-layer.md`).

## 7. Frontend architecture

None yet. The Purchases app's "Telegram Bot Integration" card
(`apps/web/src/app/(platform)/purchase/page.tsx`) explains the flow in plain
language; it does not yet show live ingestion status. Wiring it to
`GET /api/v1/purchase/bills/` is the next frontend increment.

## 8. API design

`POST /api/v1/purchase/bills/ingest/` — service-token authenticated. See
`docs/specs/purchase.md` § API design for the full contract (this is the only
ingestion endpoint that exists today; it is purchase-specific by name because
nothing generic has been designed yet — do not assume it generalizes without
a deliberate redesign).

## 9. Validation rules

- `purchase_date` cannot be in the future.
- `total_rate` must be a non-negative decimal.
- `currency` normalized to uppercase, exactly 3 characters.
- `document_url` must be a well-formed URL (today: a Telegram-hosted URL,
  not necessarily durable — see gap below).

## 10. Business logic

None at the ingestion layer by design — ingestion is a dumb pipe from
"channel extracted this" to "module, here's your data." All business rules
(what happens to a pending bill, who gets notified) live in the owning
module's service layer, not here.

## 11. Background jobs

None today — ingestion is synchronous (bot calls, waits, tells the user the
result). A queue-backed retry (Celery/RQ over Redis) is the natural upgrade
once ingestion volume or OCR latency makes synchronous calls impractical; not
needed at single-operator scale yet.

## 12. Event flow

`PurchaseBillService.ingest()` publishes `purchase.bill.ingested`
(`shared.events`), which the purchase module's own subscriber uses to write
an audit record. A generic `document.ingested` event (channel-agnostic) is a
natural addition once more than one destination module exists.

## 13. Queue design

Not built. See § Background jobs.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. Ingestion-specific test coverage that
exists today: service-token rejection (wrong/missing token), payload
validation, tenant-not-configured, and that a successful ingest notifies the
operator — `modules/purchase/backend/tests/test_ingest.py`.

## 18. Mobile integration

Not built. The native mobile app (`docs/specs/mobile-application.md`) should
offer manual photo upload as a second channel, hitting the same ingest
contract with `source_channel="upload"` — the schema already supports this
(`SourceChannel.UPLOAD` exists, unused until the mobile app exists).

## 19. Dashboard integration

Not wired. Once ingestion volume matters, "Bills ingested today" /
"Awaiting review" belong on the Executive Dashboard's procurement panel
(`apps/web/src/config/dashboard.ts`).

## 20. Future scalability

- **Durable storage** (the biggest real gap): today's `document_url` is a
  temporary, channel-hosted link, not owned storage. `platform/storage` is
  still README-only. Until it exists, every ingested document's original
  file is one Telegram cache eviction away from being unrecoverable — only
  the extracted fields are durable. This is flagged, not silently accepted;
  see the roadmap's missing-components review.
- **Generalize the ingest contract** beyond purchase bills once a second
  document type needs it (contracts, HR documents) — extract a
  `platform`-level ingestion contract instead of each module inventing its
  own `.../ingest/` endpoint shape.
- **Move OCR to a dedicated service** (`services/ocr`) if per-bot inline
  vision calls become a bottleneck or need to serve multiple channels.

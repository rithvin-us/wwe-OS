# Rules Engine — Design

**Status:** Approved 2026-07-24 (Business Operations Orchestrator roadmap) — implementation in progress.
**Scope:** Subsystem 5. A deterministic decision authority for state transitions — starting with the one real transition that exists today (`PurchaseBill.status` → `PROCESSED`/`NEEDS_ATTENTION`), currently decided by an inline `if confidence >= THRESHOLD` in `purchase_bill.py`.

## 1. Context — most of the underlying checks already exist and work

Before adding anything, audited what the roadmap's rule list actually needs versus what's already built and tested:

| Roadmap rule               | Status                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicate detection        | **Exists** — `PurchaseBillService.ingest()` already queries for a same-seller/same-invoice-number match (`purchase_bill.py`, "Duplicate detection check"). Tested, working. Not rebuilt.                                             |
| Business period validation | **Hook exists, unenforced by design** — `periods.PeriodStatus` (Subsystem 2 §9d) deliberately enforces nothing yet, reserved for exactly this subsystem.                                                                             |
| Folder policy validation   | **Exists** — `periods.resolve_location()` already refuses a rotating document type with no `business_date` (raises `ValueError`). Not rebuilt.                                                                                       |
| Storage validation         | **Exists** — `StorageService.store()` already validates size and content-type. Not rebuilt.                                                                                                                                          |
| GST validation             | **Missing** — no format check exists anywhere. Added here.                                                                                                                                                                           |
| Vendor validation          | **Exists as a boolean, not a named rule** — `seller_name != "Pending OCR Processing"` inline. Promoted into the named decision below.                                                                                                |
| Invoice numbering          | Interpreted narrowly (see §2c) — no mandatory-presence rule, since `invoice_number` is legitimately blank on many real bills (OCR didn't confidently extract one) and existing tests confirm a blank number must not block approval. |

**The actual gap**, matching "Only the Rules Engine can approve state transitions": the approval _decision_ — given everything already known about a bill, is it `PROCESSED` or does a human need to look at it — is made by an unnamed `if` statement inside `PurchaseBillService.ingest()`, not by anything callable, testable, or reusable on its own. That decision authority moves to `platform/rules`; the facts it decides on (confidence score, duplicate flag, vendor identification, GST format, period status) stay computed exactly where they already are.

## 2. Design

**a) `RulesEngine.evaluate_purchase_bill()` takes already-known facts, not raw records.** It does not query the database or call AI itself — `is_duplicate`, `confidence`, `seller_name`, `gst_number`, `period_status` are passed in by the caller, which already computed every one of them. This is deliberate: "AI never commits business data; only the Rules Engine approves" means AI's confidence score is an _input_ to a deterministic decision, not something that writes `bill.status` directly — the engine is the single seam between "what AI/lookups found" and "what state this record is allowed to enter." It does not need database access to be that seam.

**b) GST format validation is a small, standalone pure function**, not folded into the engine's signature — `validate_gst_number(value: str) -> bool` (standard 15-character GSTIN pattern). Reusable anywhere a GST number needs checking (vendor records, future modules), independently testable, and the engine calls it internally rather than requiring every caller to pre-validate.

**c) "Invoice numbering" rule, scoped to not break real behavior.** `test_ingest_creates_processed_bill` (existing, passing) ingests a bill with **no** `invoice_number` in its extraction and expects `PROCESSED` — a huge share of real OCR extractions won't confidently find an invoice number either. Requiring one would manufacture false `NEEDS_ATTENTION`s on every such bill. The rule that's real and safe to add: when an invoice number _is_ present, it participates in the existing duplicate-detection query (already true, unchanged); when absent, nothing new is required. No blank-number-blocks-approval rule is added.

**d) Reasons are visible without a schema change.** `RuleEvaluation.reasons` (e.g. `["low_confidence", "invalid_gst_format"]`) get stashed into `PurchaseBill.raw_extraction["rule_reasons"]` — the existing JSON field already used to keep "the full OCR/extraction payload... for audit and reprocessing" (`purchase_bill.py` model docstring). No new column, no migration; the review queue (`test_review.py`'s existing surface) can read `raw_extraction["rule_reasons"]` if a future UI wants to show _why_ a bill needs attention, without this subsystem building that UI.

**e) `CONFIDENCE_THRESHOLD` moves to `platform/rules`, single source of truth.** It's a deterministic policy constant, not a purchase-module implementation detail — `purchase_bill.py`'s own copy is deleted, replaced with an import.

## 3. Out of scope

Enforcing `PeriodStatus` beyond exposing it as one more input fact (still nothing rejects a write elsewhere in the platform — only this one evaluation reads it, and no currently-existing code ever sets a period to `CLOSED`, so this check is real but dormant until a future subsystem sets that status); rules for any module besides `purchase` (no other module has an AI-confidence-driven state transition yet); a rules-configuration UI; a generic rule-registry (unlike `periods`/`workflow`, there is exactly one evaluation function needed today — a registry for one entry would be speculative).

## 4. Test plan

- `test_rules_validators.py` — `validate_gst_number`: valid GSTIN passes, malformed (wrong length, lowercase, bad checksum position) fails, empty string is not validated as a format error (absence is handled by the engine, not the validator).
- `test_rules_service.py` — `evaluate_purchase_bill`: high confidence + identified vendor + no duplicate + no GST + no period status → `APPROVED`, empty reasons; low confidence → `NEEDS_ATTENTION` with `"low_confidence"`; unidentified vendor → `"vendor_unidentified"`; duplicate flag → `"duplicate_invoice"`; malformed GST (when supplied) → `"invalid_gst_format"`; `period_status=CLOSED` → `"period_closed"`; multiple simultaneous failures all appear in `reasons`.
- Additive cases in `test_ingest.py`: existing processed/needs-attention tests pass **unmodified**; a new case with a malformed GST number lands in `needs_attention` with the reason recorded in `raw_extraction["rule_reasons"]`.

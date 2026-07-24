# Rules Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** `platform/rules` — `validate_gst_number()` (pure), `RulesEngine.evaluate_purchase_bill()` (deterministic, facts-in), and `purchase` routing its status decision through it. Zero regressions to `test_ingest.py`.

**Architecture:** See `docs/superpowers/specs/2026-07-25-rules-engine-design.md`.

## Global Constraints

- Gate per task: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- `test_ingest.py` stays green with only additive cases.
- No DB/AI access inside `RulesEngine` itself — facts are passed in.
- No mandatory-invoice-number rule (design §2c — would manufacture false positives against real behavior).
- Known, pre-existing, unrelated failure: `test_contracts.py::test_expiry_scan_expires_and_reminds` — not this plan's regression.
- Small commits: one per task.

## Milestones

| #   | Milestone               | Tasks | Exit criteria                                                                |
| --- | ----------------------- | ----- | ---------------------------------------------------------------------------- |
| M1  | App + validator         | 1     | `rules` app installed, `validate_gst_number` tested standalone               |
| M2  | Engine                  | 2     | `evaluate_purchase_bill` deterministic, all reason paths tested              |
| M3  | Module adoption         | 3     | purchase routes its decision through the engine, `test_ingest.py` unmodified |
| M4  | Production-quality gate | 4     | full gate green, committed                                                   |

---

### Task 1: App skeleton + GST validator

**Files:** `platform/rules/{__init__.py,apps.py,validators.py}`, `platform/tests/test_rules_validators.py`.

- [ ] `RulesConfig` (name="rules"), added to `PLATFORM_APPS_BEFORE_MODULES` after `"metadata"`.
- [ ] `validators.py`: `validate_gst_number(value: str) -> bool` — standard 15-char GSTIN pattern (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`), empty string returns `True` (absence isn't a format error — the engine decides what to do with absence).
- [ ] Failing tests first → implement → green.
- [ ] Full verify. Commit.

### Task 2: `RulesEngine.evaluate_purchase_bill`

**Files:** `platform/rules/services.py`, `platform/tests/test_rules_service.py`.

**Acceptance criteria:** matches design §4's exact scenario list; no DB queries inside the engine (all facts are plain arguments); `CONFIDENCE_THRESHOLD` lives here as the single source of truth.

- [ ] Failing tests per design §4 → implement `RuleOutcome`, `RuleEvaluation`, `RulesEngine.evaluate_purchase_bill(*, confidence, seller_name, gst_number="", is_duplicate=False, period_status=None) -> RuleEvaluation`.
- [ ] Green. Full verify. Commit.

### Task 3: `purchase` integration

**Files:** Modify `modules/purchase/backend/services/purchase_bill.py`. Append to `modules/purchase/backend/tests/test_ingest.py`.

**Acceptance criteria:** the existing `if confidence >= CONFIDENCE_THRESHOLD and is_identified: PROCESSED else NEEDS_ATTENTION` block is replaced by a call to `RulesEngine().evaluate_purchase_bill(...)`; `bill.raw_extraction["rule_reasons"]` holds the evaluation's reasons list; the module's own `CONFIDENCE_THRESHOLD` constant is deleted, replaced by an import from `platform/rules`; every existing `test_ingest.py` test passes unmodified (this is the acceptance gate — if `test_ingest_creates_processed_bill` or `test_ingest_low_confidence_creates_needs_attention` need a code change to pass, the port is wrong, not the test).

- [ ] Write a failing test: a bill ingested with a malformed `gst_number` in its extraction lands in `needs_attention` with `"invalid_gst_format"` in `raw_extraction["rule_reasons"]`.
- [ ] Replace the inline decision with the `RulesEngine` call; wire `is_duplicate` (already computed) and `period_status` (read from the `BusinessPeriod` the bill's `PeriodService.record_document` call already touches, if available — `None` if the period lookup isn't available for some reason, never a hard failure) as inputs.
- [ ] Run the **entire** `test_ingest.py` file — every original test must pass with zero changes.
- [ ] Full verify. Commit.

### Task 4: Final verification

- [ ] `pytest -q`, `manage.py check`, `ruff check platform`, `ruff format --check platform` all green (contracts flake excluded, noted).
- [ ] `pnpm --filter web build` unchanged.
- [ ] Commit if formatting needed a fix.

## Migration plan

None — no new models.

## Rollback considerations

Task 1-2 are a new, unreferenced app until Task 3 lands — revertible with `git revert`. Task 3's change is isolated to one function's internals in `purchase_bill.py`; reverting it restores the exact prior inline decision logic (the `CONFIDENCE_THRESHOLD` constant would need to be restored alongside it — noted in the revert commit if it ever happens).

## Regression risks

| Risk                                                                                                                                 | Mitigation                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Porting the decision changes behavior for an existing test case (e.g. threshold comparison direction, `Decimal` vs `float` mismatch) | Task 3's acceptance gate is the **unmodified** existing suite, not just new cases — a passing `test_ingest_creates_processed_bill`/`test_ingest_low_confidence_creates_needs_attention` with zero test changes is the actual proof |
| A `period_status` lookup added to `ingest()` introduces a new failure mode (e.g. period lookup raises)                               | Never a hard failure — read defensively, default to `None` if unavailable, exactly like the existing storage-fetch tolerance pattern already in this function                                                                      |

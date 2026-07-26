# HR Migration — Legacy AutoSync HR → `modules/hr`

**Status: complete.** The legacy folder has been deleted; `modules/hr` is
the HR system. Supersedes the speculative parts of
`hr-integration-strategy.md`. That document was written before anyone had
seen the HR app; this one is written from its source. Where the two
disagree, this one is right.

The decision recorded in `CLAUDE.md` ("HR already exists — do not build it")
has been **reversed by the operator**: the standalone app is being retired
into WWE OS. Phase 4 of the integration strategy is now the plan, and phases
1–3 are skipped — there is no long parallel-run period, because the source
code (not just an API) is available.

## 1. Source of truth

The legacy application sat in the repo root as `HR manager/` — temporary,
git-ignored, never committed, never imported from. It was a read-only reference
during migration and **has now been deleted** (§ 9), along with the
`.gitignore` / `.prettierignore` / `eslint.config.mjs` entries that existed only
to keep it out of the toolchain.

Legacy identity: *AutoSync HR — HR Statutory Register Automation for Water
Works Engineering*. ~10,800 lines of Python plus a Next.js frontend, a face
recognition microservice, and a Capacitor mobile check-in app.

## 2. What the legacy app actually does

Indian labour law requires factories to maintain statutory registers as
official Excel documents — Form B (Wage Register), Form XXVI (Muster Roll),
wage slips, In-Out register, and others. The app replaces filling them by
hand. Monthly cycle:

```
Employee Master → Attendance grid → Run Payroll → Generate Registers
```

Generation copies an immutable company template, fills ten forms from the
database, archives the workbook with a SHA-256 fingerprint, and locks the
month so submitted figures cannot silently change.

## 3. Stack gap — and what it means for "do not rewrite verified code"

| | Legacy | WWE OS |
|---|---|---|
| Framework | FastAPI | Django 6 + DRF |
| ORM | async SQLAlchemy 2 | Django ORM |
| Migrations | Alembic | Django migrations |
| Schemas | Pydantic v2 | DRF serializers |
| Identity | own `User` + PyJWT | `platform/auth` |
| Tenancy | none | `TenantOwnedModel`, tenant-scoped |
| PKs | autoincrement int | UUID |

The frameworks do not overlap, so a literal copy of the whole backend is
impossible. The rule still holds where it can, so every legacy file is
classified up front:

**Copied verbatim** (pure Python, no framework imports — logic must not
change, and the ported tests prove it):

- `services/shift_rules.py` — shift definitions G/M/E/N, swipe validation,
  worked hours, daily OT, late/early flags, midnight-crossing night shifts.
- `services/payroll_types.py` — the engine's dataclass I/O contract.
- `services/payroll_engine.py`, pure half — `compute_hours_from_swipe`,
  `count_attendance_days`, `calculate_prorated_wages`,
  `calculate_statutory_deductions`, `calculate_other_deductions`,
  `compute_employee_payroll`, and the status-code sets.
- `services/geofence.py`, `services/face_recognition.py`,
  `services/face_client.py`.
- `excel/generator.py`, `excel/mapper.py`, `excel/writer.py` — openpyxl
  template filling; only the data-access calls are re-pointed.
- `mappings/*.json` — the ten form cell maps. Data, not code.
- `templates/HR details Template.xlsx` — the immutable company template.
- `face-ai/` — moves wholesale to `services/face-ai/`.
- `tests/test_shift_rules.py`, `tests/test_payroll_engine.py`,
  `tests/test_geofence.py`, `tests/test_face_*.py`,
  `tests/test_attendance_punch.py` — the parity proof.

**Mechanically re-expressed** (same semantics, different framework — no
behaviour decisions get revisited):

- `models/*.py` → Django models, identical fields and identical enum
  *string values* (the strings appear in the statutory forms and on the
  wire, so they are part of the contract).
- `repositories/*.py` → Django querysets.
- `api/*.py` + `schemas/*.py` → DRF views + serializers, same URL shapes.
- `PayrollEngine` orchestrator class — repository calls swapped, calculation
  path untouched.

**Deleted, replaced by a platform capability** (§ 4).

**Rebuilt** — the frontend only, because the Design Bible forbids a second
sidebar, header, login or notification centre, and legacy screens ship their
own. Screen *behaviour* is preserved exactly; the components are `@bop/ui`.

## 4. Legacy subsystem → platform capability

| Legacy | Fate |
|---|---|
| `models/user.py`, `auth/jwt_handler.py`, `api/auth.py` | **Deleted.** `platform/auth` owns identity. `Employee` stays HR business data, separate from the platform `User` (`docs/modules/hr.md` § 3). |
| `services/audit_service.py`, `models/audit_log.py` | **Deleted.** `platform/audit` → `AuditService.record()`. |
| `services/archive_service.py` | **Deleted.** `platform/storage` `StorageService.store()` already computes SHA-256 and `verify_integrity()` already checks it; `periods.record_document()` tracks the month's manifest. |
| `models/generation_log.py` | **Kept as an HR model**, referencing `StoredFile`. Storage has no notion of a *version per month*, nor of close/reopen with a mandatory reason — those are register-compliance facts. |
| `models/period_lock.py`, `services/period_lock_service.py` | **Promoted to `platform/periods`.** Locking a business month is a capability, not HR meaning, and `periods` already owns period lifecycle (it has `PeriodStatus` but today no write-guard). HR calls `assert_open()`; the model is not recreated in the module. |
| `excel/*` + `mappings/*` | **Stays in the module.** Indian statutory form layout is domain meaning. `platform/reporting`'s `ReportSpec` is generic columns-and-rows and cannot express a template-filled legal form — using it here would be forcing the wrong shape. Flat data views (wage register, attendance summary) *do* get registered as `reporting` reports. |
| `services/policy_chat.py` | Re-pointed at `platform/ai` `AIService.generate()`. |
| `api/assets.py`, `models/asset.py` | **Not migrated.** `modules/assets` already owns assets in WWE OS; duplicating it would break the one-owner rule. Employee↔asset linkage goes through that module. |
| `api/expenses.py`, `models/expense.py` | **Migrated into HR.** The payroll engine reimburses approved claims after deductions (never into gross, so PF/ESI bases stay untouched) — the coupling is real, and `modules/finance` does not exist yet. |
| `services/analytics.py` | Migrated into HR; feeds the Executive Dashboard through `apps/web/src/config/dashboard.ts`, not a module-local dashboard. |
| `face-ai/` | → `services/face-ai/`. `services/` are deployment-isolated with their own Dockerfile and integrate over API — exactly what this already is. |
| `attendance_app/` (Capacitor) | → the planned `apps/mobile` (Expo) workstream. The public check-in endpoint is preserved so the existing installed app keeps working during cutover. |
| Search, tags, notifications, workflow | New wiring, not migration: `search/adapter.py`, `PermissionDef` registry, `register_report`, event subscribers — all following `modules/purchase/backend` exactly. |

## 5. Data model translation rules

1. Every HR table is `TenantOwnedModel` — UUID PK, soft delete, tenant FK.
2. Uniqueness becomes per-tenant: `employee_code` is
   `UniqueConstraint(tenant, employee_code)`, not globally unique. Same for
   `(tenant, employee, year, month, day)` on attendance,
   `(tenant, employee, year, month)` on payroll, `(tenant, date)` on holidays.
3. Enum string values are preserved exactly — `"P"`, `"HD"`, `"PL"`, `"NH"`,
   `"WH"`, `"WO"`, `"CO"`, `"NJ"`, `"LEFT"`, `"L"`; `"Active"`/`"Left"`/
   `"New Joining"`; `"Skilled"`/`"Semi Skilled"`/`"Unskilled"`;
   `"Advance"`/`"Fine"`/`"Damage"`/`"Loan"`/`"Other"`. They appear in
   generated statutory forms and in the attendance grid wire format.
4. Employees are never hard-deleted — status flips to `Left` with
   `date_of_leaving`. The platform's soft-delete default already matches.
5. Attendance keeps raw swipe times *and* the per-day computed
   `worked_hours` / `ot_hours`, so monthly OT stays `SUM(daily OT)` and every
   figure remains re-derivable for audit.
6. `Payroll.employee_name` / `employee_code` stay derived from the
   relationship, never duplicated columns, so payroll always reflects the
   current Employee Master.

## 6. Wave order

Each wave ends green (`pytest`, `ruff check`, `manage.py check`) before the
next starts.

1. **Scaffold** — `modules/hr/backend` as a Django app, permission registry,
   URL wiring, `MODULE_APPS` entry. **Built.**
2. **Core models** — Employee, SalaryRule, PayRulesConfig, Attendance,
   Holiday, Deduction, Payroll + migration 0001. **Built.**
3. **Engines** — shift rules and payroll engine copied; ported tests as the
   parity gate. **Built** — the pure half is byte-identical to legacy and the
   legacy test suites pass against it unchanged.
4. **Repositories / services / API** — the monthly cycle end to end. **Built**
   — 15 endpoints under `/api/v1/hr/`.
5. **Period locking** in `platform/periods`. **Built.**
6. **Statutory registers** — generator, mappings, template, storage-backed
   archive, generation log. **Built.**
7. **Leave engine. — built.**
8. **Face check-in** + `services/face-ai`. **Built.**
9. **Onboarding, expenses, analytics, policy chat. — built.**
10. **Frontend** under `(platform)/hr`. **Built.**
11. **Legacy data import** command. **Built.**
12. **Parity verification, then deletion. — built.**

## 7. Verification — what "identical behaviour" means here

- The legacy engine tests are ported, not rewritten. `test_payroll_engine.py`
  is 508 lines of formula assertions; if the ported engine passes them
  unchanged, the arithmetic is the same arithmetic.
- Generated workbooks are compared cell-by-cell against a legacy-generated
  workbook for the same input month, before the legacy app is deleted.
- Register generation is checked to still: work on a template *copy*, write
  an immutable versioned log with a SHA-256, and lock the period.

## 8. Preserve before deleting — non-code assets

**These live only inside `HR manager/` and are destroyed with it.** All have
been copied out; none is regenerable from source code:

| Asset | Copied to |
|---|---|
| `backend/templates/HR details Template.xlsx` — the immutable company template every register is built from | `modules/hr/backend/services/registers/templates/` |
| `backend/mappings/*.json` — the ten form cell maps | `modules/hr/backend/services/registers/mappings/` |
| `backend/app/data/company_policies.md` — the policy-chat corpus | `modules/hr/backend/data/` |
| `backend/archive/*.xlsx`, `backend/generated/*.xlsx` — previously generated workbooks | `.hr-migration-data/` (git-ignored) |
| `backend/uploads/receipts/` — expense claim attachments | `.hr-migration-data/uploads/` |
| `backend/hr_automation.db`, `backend/data/hr.db` | `.hr-migration-data/db/` |

### Correction: the database is not where the data is

An earlier draft of this document called the bundled sqlite files "live
production HR data". **That was wrong, and it changes the risk picture:**

- `backend/data/hr.db` is **0 bytes**.
- `backend/hr_automation.db` holds one user, one `pay_rules_config` row, three
  audit rows and an alembic version marker. `employees`, `attendance`,
  `payroll`, `salary_rules`, `holidays`, `deductions`, `generation_logs` and
  `period_locks` are all **empty**.

The legacy app's real data lives in a Render-managed PostgreSQL database
(`hr-automation-db` in `render.yaml`, reached via `DATABASE_URL`). It is not in
this folder and is not affected by deleting it.

So deleting `HR manager/` risks the **template, cell maps, policy corpus and
archived workbooks** — not the employee records. Those are copied out, and the
archived workbooks are kept because they are filed compliance documents.

### Importing the real data at cutover

```
python manage.py import_legacy_hr --source <sqlite-path-or-postgres-url> --tenant <slug>
```

Reads the legacy database and upserts into WWE OS. Dry run by default;
`--commit` writes. It never modifies the source, and matches on natural keys, so
it is safe to run repeatedly: import, check, re-import after a few more days of
legacy use, then cut over.

Identity (`users`) and the legacy `audit_logs` are deliberately **not**
imported. WWE OS owns identity, and copying another application's audit rows in
would make this system's audit trail misrepresent its own provenance.

## 9. Deleting the legacy folder

Deletion is the last step, gated on every item in § 7 passing, on § 8 being
complete, and on an explicit go-ahead from the operator.

It is still irreversible — without § 8 the company template and cell maps are
gone — but it does **not** destroy the production employee database.

Before deleting, `grep -ri "HR manager"` across `apps/`, `platform/`,
`modules/`, `services/`, `packages/` and `docs/` must return nothing but this
document and the tooling-ignore entries that reference the folder by name
(`.gitignore`, `.prettierignore`, `eslint.config.mjs`), which are removed with
it.

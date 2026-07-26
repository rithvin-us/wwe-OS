# Module Intelligence · Finance

Route `/finance` · Domain: Operations · Status: Partly built —
**Invoicing (§13) is implemented**; budgets, expense claims and obligations
(§1-§12) remain planned.

## 1. Business purpose

Track budgets, expenses, and payment obligations arising from operations — the money view over every other module's activity. (Not a general ledger; it integrates with accounting, it does not replace it.)

## 2. Problems it solves

- Budget owners discover overruns after the fact
- Expense claims on paper with no policy checks
- Payment obligations from contracts and POs tracked nowhere
- Finance reporting assembled manually each month

## 3. Primary users

Finance officers, budget owners, executives, employees (expense claims).

## 4. Future integrations

Purchase Orders (committed spend), Contracts (obligations), HR (payroll inputs), Workflow (claim approvals), Reports (statements), external accounting system (export).

## 5. Database entities

`budget`, `budget_line`, `expense_claim`, `expense_line`, `payment_obligation`, `payment_record`, `fiscal_period`, `exchange_rate`.

## 6. APIs

- `GET/POST /api/finance/budgets` · `GET /api/finance/budgets/{id}/utilization`
- `GET/POST /api/finance/expense-claims` · `POST /api/finance/expense-claims/{id}/decide`
- `GET /api/finance/obligations?due=30d` · `POST /api/finance/payments`

## 7. Dashboard widgets

Budget utilization by department · Claims awaiting approval · Obligations due · Committed vs actual spend.

## 8. KPIs

Budget variance · Claim approval cycle time · On-time payment rate · Forecast accuracy.

## 9. Permissions

`finance.budget.read/manage`, `finance.claim.submit/approve`, `finance.payment.record`, `finance.admin`.

## 10. Navigation structure

Overview · Budgets · Expense claims · Obligations · Periods.

## 11. Relationships with other modules

Consumes committed spend from Purchase, obligations from Contracts, payroll aggregates from HR; feeds Analytics and Reports; approvals via Workflow.

## 12. AI opportunities

Expense-policy checks on claims (receipt vs policy via OCR) · Spend forecasting · Anomalous transaction flagging.

---

## 13. Invoicing — **Built**

Outgoing billing: the company raises AMC and Sales invoices on its own paper
format and keeps one register of every bill it has ever issued.

### Entities

| Model                   | Table                      | Purpose                                                                                                                                                   |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Customer`              | `finance_customer`         | Billing/site master. `is_sez` is set here and nowhere else.                                                                                               |
| `InvoiceNumberSequence` | `finance_invoice_sequence` | One counter per (tenant, financial year), shared by AMC and Sales.                                                                                        |
| `Invoice`               | `finance_invoice`          | The bill register. Customer details are snapshotted; DB constraints make a duplicate number impossible. Carries `status`, `revision`, and both documents. |
| `InvoiceLine`           | `finance_invoice_line`     | One printed item row.                                                                                                                                     |

### Rules

- **Numbering** — `G/M/<n>/<financial year>`, e.g. `G/M/12/2026-27`. Financial
  year runs April-March. Prefix is `INVOICE_NUMBER_PREFIX`. Allocation takes
  `max(counter, highest number saved) + 1` inside a transaction, so an
  imported or back-filled bill still pushes the sequence past itself and a
  soft-deleted (cancelled) bill never returns its number. Previewing computes
  the number without reserving it; only generation reserves.
- **SEZ** — `Customer.is_sez` decides the tax mode: SEZ → IGST at the full
  rate on one row; otherwise CGST + SGST, each at half the rate. Default rate
  18%, overridable per invoice.
- **AMC month text** — AMC invoices print "For the month of &lt;month&gt; -
  &lt;year&gt;" above the items, defaulting to the month before the invoice
  date; an explicit billing period wins. Sales invoices leave the row blank.
- **Rounding** — taxes are charged on the sum of the line values, the invoice
  is rounded to the nearest rupee, and the difference prints on the R/OFF row.
- **Correcting** — a raised bill keeps its number. `update` recomputes it end
  to end, regenerates both documents, replaces the superseded ones, and bumps
  `revision`. It refuses to move a bill into another financial year (that
  would change its number — cancel and re-raise instead).
- **Cancelling** — a bill is never deleted; the API has no DELETE. `cancel`
  records a reason and a timestamp and leaves the number consumed forever.
  The documents that were already issued are left exactly as issued.
- **Locked periods** — raising, correcting and cancelling all call
  `PeriodService.assert_open`, so once a month's figures have been submitted
  and the period locked, its bills stop moving.

### The template

`modules/finance/backend/templates/invoice_template.xlsx` (path:
`INVOICE_TEMPLATE_PATH`) is the master format, converted once from the
operator's `.xls` because openpyxl reads only the modern format. It is used as
a _format only_ — the sample item and sample month text inside it are wiped on
every render. `services/renderer.py` pins the item and totals rows as
constants and verifies the labels that anchor them, failing loudly if the
workbook is edited so the geometry moves. Beyond the template's own nine item
rows it inserts rows, re-lays the merges/heights the insert would have broken,
and stamps one canonical style on every item row, so item thirty looks and
calculates exactly like item one.

### The PDF

Every invoice produces two documents: the `.xlsx` (the master the figures live
in) and the `.pdf` (the copy that leaves the building). `INVOICE_PDF_ENGINE`
picks how the PDF is made:

- `reportlab` (default) — drawn in pure Python, so it works on every host,
  including Render's native runtime, which has no LibreOffice and no way to
  install one. It is a faithful _redraw_ of the format, not a pixel copy. The
  company block (name, address, GST number, bank, terms, declaration) is read
  back out of the master template by `renderer.read_letterhead()` — those
  details are still edited only in the workbook.
- `libreoffice` — converts the generated workbook itself, so the PDF _is_ the
  workbook. Needs the binary on the host (`platform/Dockerfile` installs it, a
  native Render deploy does not).

`POST /invoices/preview-document/` renders the same PDF watermarked PREVIEW,
before the invoice exists — no number taken, no file written.

### Storage

Invoices are filed through `platform/storage` at a `platform/periods` path:
`<tenant>/<year>/<Month>/<AMC Invoices|Sales Invoices>/<number>_<customer>.xlsx`.
A copy always exists on local disk under `INVOICE_LOCAL_ARCHIVE_PATH` (default:
the local storage root) even when `STORAGE_BACKEND` points at an object store —
the operator keeps their own books. The absolute path is reported back on the
invoice as `local_path`.

### APIs

- `GET/POST/PATCH/DELETE /api/v1/finance/customers/` — the billing master
- `GET /api/v1/finance/invoices/` — the bill register (no DELETE)
- `POST /api/v1/finance/invoices/` — generate (reserves a number)
- `PATCH /api/v1/finance/invoices/{id}/` — correct, same number, new revision
- `POST /api/v1/finance/invoices/{id}/cancel/` — `{"reason": "..."}`
- `POST /api/v1/finance/invoices/preview/` — the figures, no number taken
- `POST /api/v1/finance/invoices/preview-document/` — the PDF, watermarked
- `GET /api/v1/finance/invoices/next-number/` — the upcoming number
- `GET /api/v1/finance/invoices/{id}/download/` — the workbook
- `GET /api/v1/finance/invoices/{id}/pdf/` — the PDF, inline

The browser holds no Django token, so `apps/web` reaches the file endpoints
through its own proxy routes under `/api/finance/…` (see
`apps/web/src/config/invoices.ts` for the URL helpers).

### Permissions

`finance.invoice.read`, `finance.invoice.generate`, `finance.invoice.cancel`,
`finance.customer.manage`.

### UI

Automation tab → **Invoice generation** card (type, customer, date, billed
month, line items, check figures, preview the document, generate). The
register and the customer/site master live at `/invoices/register`, where each
row can be opened as a PDF, downloaded as a workbook, corrected, or cancelled
with a reason.

# Module Intelligence · Finance

Route `/finance` · Domain: Operations · Status: Planned

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

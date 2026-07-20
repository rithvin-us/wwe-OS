# Module Intelligence · Approvals

Route `/approvals` · Domain: Insight & decisions · Status: Planned

## 1. Business purpose

Give every approver one inbox for decisions raised anywhere in the platform — leave, purchases, contracts, adjustments — powered by the workflow engine.

## 2. Problems it solves

- Approvals scattered across modules, mail, and chat
- Approvers unaware of pending items until chased
- No view of decision load or bottlenecks
- Delegation during absence handled informally

## 3. Primary users

Managers and any approver role; executives (bottleneck view); admins (delegation rules).

## 4. Future integrations

Workflow engine (source of truth), Notifications, Telegram (approve from chat), Email (approve from mail), all business modules (items).

## 5. Database entities

Thin module — reads workflow engine tables: `approval_item` (view over workflow tasks), `delegation_rule`, `decision_note`.

## 6. APIs

- `GET /api/approvals/inbox` · `POST /api/approvals/{task_id}/approve`
- `POST /api/approvals/{task_id}/reject` · `POST /api/approvals/{task_id}/delegate`
- `GET/POST /api/approvals/delegations`

## 7. Dashboard widgets

My pending approvals by module · Aging items · Decisions this week · Active delegations.

## 8. KPIs

Median decision time · SLA breaches · Delegation coverage during absence · Re-work rate (rejected then resubmitted).

## 9. Permissions

Inherited: an item appears only for users the Workflow engine routes it to. Module-level: `approvals.delegate.manage`, `approvals.admin`.

## 10. Navigation structure

Inbox · Done · Delegations.

## 11. Relationships with other modules

Pure consumer of the Workflow engine; every module that declares an approval step appears here automatically — no per-module integration work.

## 12. AI opportunities

Decision summaries ("what am I approving and why") · Risk highlights on unusual requests · Suggested decision based on precedent, always human-confirmed.

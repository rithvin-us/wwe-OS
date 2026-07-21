# Platform · Workflow

Generic workflow and approval engine. **Built (core engine)** — definitions,
sequential steps, instances, approve/reject/cancel, permission-gated steps,
full action history, events, notifications, API. SLA timers and escalation
remain future scope (see `docs/specs/workflow-engine.md` § 1b).

- Owns: workflow definitions, versioned steps, instances, the action trail,
  approval routing (via platform permission codes).
- Does not own: the business meaning of any workflow (module territory).

## How a module uses it

```python
from workflow.services import WorkflowService

# 1. Declare (idempotent — post_migrate is the natural place):
WorkflowService().ensure_definition(
    key="purchase-bill-approval",
    name="Purchase bill approval",
    module="purchase",
    steps=[
        {"key": "review", "name": "Operator review",
         "required_permission": "purchase.bill.review"},
    ],
)

# 2. Start for one of your objects:
WorkflowService().start(definition_key="purchase-bill-approval", subject=bill)

# 3. React to outcomes (in your events/subscribers.py):
from shared.events import Events, subscribe
subscribe(Events.WORKFLOW_COMPLETED, my_handler)   # also REJECTED / CANCELLED
```

API: `/api/v1/workflow/definitions/`, `/api/v1/workflow/instances/` (+
`pending/`, `{id}/approve/`, `{id}/reject/`, `{id}/cancel/`). The pending
queue feeds the dashboard's "needs your attention" surface.

Permissions: `workflow.view`, `workflow.act`, `workflow.manage` (Owner holds
all three automatically). Every event lands in the audit trail.

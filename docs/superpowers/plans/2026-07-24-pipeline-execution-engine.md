# Pipeline Execution Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic, DB-persisted pipeline execution engine (`platform/workflow`) with retries, crash recovery, and pause/resume/cancel/retry — then migrate `platform/automation`'s rule execution to run on it, with zero breakage to the existing `/automation` frontend.

**Architecture:** No task queue. Every pipeline run and step is a database row (`PipelineRun`, `PipelineStepRun`); a management command ticks runs forward one step at a time via atomic `UPDATE ... WHERE status = <expected>` claims (portable across SQLite tests and Postgres prod — `SELECT ... FOR UPDATE` is Postgres-only, so it's not used). Crash recovery = reclaiming steps stuck `running` past a timeout. Rollback = per-step `compensate()` callbacks run in reverse (a saga, not a DB transaction). Automation's `run_rule()` becomes a thin wrapper that starts a pipeline and synchronously drains it with the same primitive a future incremental tick loop will use — no duplicated execution logic between "sync" and "async" callers.

**Tech Stack:** Django 6, DRF, PostgreSQL (SQLite for tests) — no new dependencies.

## Global Constraints

- Gate before any task counts as done: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean (per `CLAUDE.md`).
- `platform/tests/test_automation.py` must pass **completely unmodified** by the end of this plan — it is the backward-compatibility acceptance test, not just a suite to keep green.
- No changes to `apps/web/src/**/automation*` — the current `/automation` frontend must keep working unchanged.
- `services/worker` and `services/scheduler` are not touched — the tick loop lives in `platform/workflow`, not in a separate deployable service (they can't import `platform/`/`modules/` source per their own README contracts and `CLAUDE.md` rule 5).
- New Django app name: `workflow` (not `orchestrator`) — reserved by `CLAUDE.md`'s own architecture-capability list and by already-declared, currently-unused `Events.WORKFLOW_*` constants in `shared/events.py`.
- Full design rationale: `docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md`.

---

## File Structure

**New app `platform/workflow/`:**

| File                                   | Responsibility                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps.py`                              | `WorkflowConfig` — no `ready()` override (registry host, not registrant)                                                        |
| `models.py`                            | `PipelineRun`, `PipelineStepRun`, status/reason/trigger enums                                                                   |
| `registry.py`                          | `StepContext`, `StepResult`, `StepDefinition`, `PipelineDefinition`, `register_pipeline`/`get_pipeline`/`all_pipelines`         |
| `engine.py`                            | `advance_one`, `_advance_compensation`, `_handle_step_failure`, `_claim_step`, `_finish_run`, `tick_all`, `reclaim_stale_steps` |
| `services.py`                          | `PipelineService`: `start`, `run_to_completion`, `request_pause/resume/cancel/retry`, `get_run`                                 |
| `serializers.py`                       | `PipelineStepRunSerializer`, `PipelineRunSerializer`                                                                            |
| `views.py`                             | `PipelineRunViewSet` (read-only + pause/resume/cancel/retry actions)                                                            |
| `urls.py`                              | router → `runs`                                                                                                                 |
| `migrations/0001_initial.py`           | generated via `makemigrations`, not hand-written                                                                                |
| `management/commands/pipeline_tick.py` | one-shot / `--loop` tick driver                                                                                                 |

**New inside `automation/`:** `pipelines.py`, `events/__init__.py` + `events/subscribers.py`, one additive migration.

**Modified:** `config/settings.py`, `config/urls.py`, `permissions/registry.py`, `automation/apps.py`, `automation/services.py`, `automation/models.py`.

**New test files (all in `platform/tests/`):** `test_workflow_registry.py`, `test_workflow_engine.py`, `test_workflow_service.py`, `test_workflow_api.py`. **Additive tests appended to** `test_automation.py` (existing tests untouched).

---

### Task 1: App skeleton, settings, permissions

**Files:**

- Create: `platform/workflow/__init__.py`, `platform/workflow/apps.py`, `platform/workflow/migrations/__init__.py`
- Modify: `platform/config/settings.py`, `platform/permissions/registry.py`

**Interfaces:**

- Produces: the `workflow` Django app label, importable from `PLATFORM_APPS_BEFORE_MODULES`.

- [ ] **Step 1: Create the app package**

`platform/workflow/__init__.py` — empty file.

`platform/workflow/apps.py`:

```python
from django.apps import AppConfig


class WorkflowConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "workflow"
    verbose_name = "Platform · Workflow"
```

`platform/workflow/migrations/__init__.py` — empty file.

- [ ] **Step 2: Register the app in `INSTALLED_APPS`, immediately before `"automation"`**

In `platform/config/settings.py`, find:

```python
PLATFORM_APPS_BEFORE_MODULES = [
    "shared",
    "tenancy",
    "users",
    "auth",
    "permissions",
    "storage",
    "ai",
    "search",
    "reporting",
    "tagging",
    "automation",
]
```

Replace with:

```python
PLATFORM_APPS_BEFORE_MODULES = [
    "shared",
    "tenancy",
    "users",
    "auth",
    "permissions",
    "storage",
    "ai",
    "search",
    "reporting",
    "tagging",
    "workflow",
    "automation",
]
```

(`workflow` must precede `automation` — automation's `ready()`, added in Task 12, imports `workflow.registry`.)

Add new settings near the bottom of the "Observability" section (after `METRICS_TOKEN = ...`):

```python
# --------------------------------------------------------------------------- #
# Pipeline execution engine (platform/workflow)
# --------------------------------------------------------------------------- #
PIPELINE_STEP_STALE_TIMEOUT_SECONDS = env_int("PIPELINE_STEP_STALE_TIMEOUT_SECONDS", 600)
PIPELINE_TICK_BATCH_SIZE = env_int("PIPELINE_TICK_BATCH_SIZE", 50)
PIPELINE_TICK_INTERVAL_SECONDS = env_int("PIPELINE_TICK_INTERVAL_SECONDS", 3)
```

- [ ] **Step 3: Add `workflow.view` / `workflow.control` permissions**

In `platform/permissions/registry.py`, add after the `# Automation` block:

```python
    # Workflow (pipeline execution engine)
    PermissionDef("workflow.view", "View pipeline runs", "Workflow"),
    PermissionDef("workflow.control", "Pause, resume, cancel, or retry a pipeline run", "Workflow"),
```

- [ ] **Step 4: Verify**

Run: `cd platform && ./.venv/Scripts/python.exe manage.py check`
Expected: `System check identified no issues (0 silenced).`

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all existing tests still pass (this step adds no new tests; it must not break any).

- [ ] **Step 5: Commit**

```bash
git add platform/workflow platform/config/settings.py platform/permissions/registry.py
git commit -m "feat(platform/workflow): scaffold the workflow app"
```

---

### Task 2: Models

**Files:**

- Create: `platform/workflow/models.py`, `platform/workflow/migrations/0001_initial.py` (generated)
- Test: `platform/tests/test_workflow_models.py`

**Interfaces:**

- Produces: `PipelineRun`, `PipelineStepRun`, `PipelineRunStatus`, `StepRunStatus`, `TerminationReason`, `PipelineTriggerType`, `ACTIVE_STATUSES`, `TERMINAL_STATUSES` (all importable from `workflow.models`).

- [ ] **Step 1: Write the failing test**

`platform/tests/test_workflow_models.py`:

```python
"""Pipeline model constraints — idempotency dedup and per-run step ordering."""

from __future__ import annotations

import pytest
from django.db import IntegrityError
from workflow.models import PipelineRun, PipelineRunStatus, PipelineStepRun

pytestmark = pytest.mark.django_db


def test_idempotency_key_is_unique_per_pipeline_and_tenant(tenant):
    PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="rule:1:2026-01-01")
    with pytest.raises(IntegrityError):
        PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="rule:1:2026-01-01")


def test_empty_idempotency_key_is_not_constrained(tenant):
    # Manual triggers pass no idempotency key — must be free to create many.
    PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="")
    PipelineRun.objects.create(tenant=tenant, pipeline_key="demo", idempotency_key="")
    assert PipelineRun.objects.filter(pipeline_key="demo").count() == 2


def test_step_index_is_unique_per_run(tenant):
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="demo")
    PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=0, step_key="a")
    with pytest.raises(IntegrityError):
        PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=0, step_key="b")


def test_default_status_is_queued(tenant):
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="demo")
    assert run.status == PipelineRunStatus.QUEUED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'workflow.models'` (or similar import error).

- [ ] **Step 3: Write the models**

`platform/workflow/models.py`:

```python
"""Pipeline execution engine storage — a PipelineRun (one execution of a
registered PipelineDefinition, see workflow/registry.py) and its
PipelineStepRun children (one row per step, persisted before and after
execution so a crashed process loses no state — see workflow/engine.py).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class PipelineRunStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    PAUSED = "paused", "Paused"
    COMPENSATING = "compensating", "Compensating"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


ACTIVE_STATUSES = frozenset(
    {PipelineRunStatus.QUEUED, PipelineRunStatus.RUNNING, PipelineRunStatus.COMPENSATING}
)
TERMINAL_STATUSES = frozenset(
    {PipelineRunStatus.SUCCESS, PipelineRunStatus.FAILED, PipelineRunStatus.CANCELLED}
)


class TerminationReason(models.TextChoices):
    NONE = "", "—"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class PipelineTriggerType(models.TextChoices):
    SCHEDULE = "schedule", "Schedule"
    MANUAL = "manual", "Manual"
    EVENT = "event", "Event"


class StepRunStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"
    COMPENSATING = "compensating", "Compensating"
    COMPENSATED = "compensated", "Compensated"
    COMPENSATION_FAILED = "compensation_failed", "Compensation failed"


class PipelineRun(TenantOwnedModel):
    pipeline_key = models.CharField(max_length=100, db_index=True)
    pipeline_version = models.PositiveIntegerField(default=1)
    # Step order snapshotted at start() — frozen so a later registry change
    # can't corrupt an in-flight run's meaning.
    step_keys = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=13, choices=PipelineRunStatus.choices, default=PipelineRunStatus.QUEUED,
        db_index=True,
    )
    termination_reason = models.CharField(
        max_length=10, choices=TerminationReason.choices, blank=True,
        default=TerminationReason.NONE,
    )
    current_step_index = models.PositiveIntegerField(default=0)
    # Accumulates {step_key: StepResult.output} as steps succeed.
    context = models.JSONField(default=dict, blank=True)
    trigger_type = models.CharField(
        max_length=10, choices=PipelineTriggerType.choices, default=PipelineTriggerType.SCHEDULE,
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    # Opaque back-reference — same (module, object_type, object_id) idiom
    # platform/tagging already uses, so the engine never needs a FK to any
    # business model.
    source_module = models.CharField(max_length=50, blank=True, default="")
    source_object_type = models.CharField(max_length=100, blank=True, default="")
    source_object_id = models.CharField(max_length=64, blank=True, default="")
    # Non-empty only for scheduled triggers — see automation's use in Task 14.
    idempotency_key = models.CharField(max_length=200, blank=True, default="")
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "pipeline_run"
        indexes = [
            models.Index(fields=["tenant", "status", "pipeline_key"]),
            models.Index(
                fields=["tenant", "source_module", "source_object_type", "source_object_id"]
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "pipeline_key", "idempotency_key"],
                condition=~models.Q(idempotency_key=""),
                name="uniq_pipeline_run_idempotency",
            )
        ]

    def __str__(self) -> str:
        return f"{self.pipeline_key} · {self.status}"


class PipelineStepRun(TenantOwnedModel):
    run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name="steps")
    step_index = models.PositiveIntegerField()
    step_key = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20, choices=StepRunStatus.choices, default=StepRunStatus.PENDING,
    )
    attempt = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    output = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta(TenantOwnedModel.Meta):
        db_table = "pipeline_step_run"
        ordering = ["step_index"]
        constraints = [
            models.UniqueConstraint(fields=["run", "step_index"], name="uniq_pipeline_step_run_index")
        ]
        indexes = [models.Index(fields=["status", "locked_at"])]

    def __str__(self) -> str:
        return f"{self.run_id} · {self.step_key} · {self.status}"
```

- [ ] **Step 4: Generate the migration**

Run: `cd platform && ./.venv/Scripts/python.exe manage.py makemigrations workflow`
Expected: `Migrations for 'workflow': platform/workflow/migrations/0001_initial.py` listing the creation of `pipeline_run` and `pipeline_step_run`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_models.py -v`
Expected: 4 passed.

- [ ] **Step 6: Verify no regressions and lint**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add platform/workflow/models.py platform/workflow/migrations/0001_initial.py platform/tests/test_workflow_models.py
git commit -m "feat(platform/workflow): add PipelineRun/PipelineStepRun models"
```

---

### Task 3: Registry

**Files:**

- Create: `platform/workflow/registry.py`
- Test: `platform/tests/test_workflow_registry.py`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `StepContext(tenant, run_id, actor, data, attempt)`, `StepResult(output={})`, `StepDefinition(key, label, run, compensate=None, max_attempts=1, backoff=default_backoff, timeout_seconds=300)`, `PipelineDefinition(key, label, module, permission, version, steps)`, `register_pipeline(definition)`, `get_pipeline(key) -> PipelineDefinition` (raises `NotFoundError`), `all_pipelines() -> list[PipelineDefinition]`, `default_backoff(attempt) -> float`.

- [ ] **Step 1: Write the failing test**

`platform/tests/test_workflow_registry.py`:

```python
"""Pipeline/step registry — register/get/all, same contract as
reporting.registry and automation.registry."""

from __future__ import annotations

import pytest
from shared.exceptions import NotFoundError
from workflow.registry import (
    PipelineDefinition,
    StepContext,
    StepDefinition,
    StepResult,
    default_backoff,
    get_pipeline,
    register_pipeline,
)


def _noop(ctx: StepContext) -> StepResult:
    return StepResult(output={"ran": True})


def test_register_and_get_round_trip():
    definition = PipelineDefinition(
        key="test.pipeline.one", label="Test one", module="test", permission="test.run",
        version=1, steps=[StepDefinition(key="step-a", label="Step A", run=_noop)],
    )
    register_pipeline(definition)

    fetched = get_pipeline("test.pipeline.one")
    assert fetched.key == "test.pipeline.one"
    assert fetched.steps[0].key == "step-a"


def test_get_unregistered_pipeline_raises():
    with pytest.raises(NotFoundError):
        get_pipeline("does.not.exist")


def test_register_is_idempotent_by_key():
    from workflow.registry import all_pipelines

    definition_v1 = PipelineDefinition(
        key="test.pipeline.two", label="v1", module="test", permission="test.run", version=1,
        steps=[StepDefinition(key="a", label="A", run=_noop)],
    )
    definition_v2 = PipelineDefinition(
        key="test.pipeline.two", label="v2", module="test", permission="test.run", version=2,
        steps=[StepDefinition(key="a", label="A", run=_noop)],
    )
    register_pipeline(definition_v1)
    register_pipeline(definition_v2)

    assert get_pipeline("test.pipeline.two").label == "v2"
    assert [p.key for p in all_pipelines()].count("test.pipeline.two") == 1


def test_default_backoff_is_exponential_and_capped():
    assert default_backoff(0) == 1
    assert default_backoff(1) == 2
    assert default_backoff(2) == 4
    assert default_backoff(20) == 300  # capped
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_registry.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'workflow.registry'`.

- [ ] **Step 3: Write the registry**

`platform/workflow/registry.py`:

```python
"""Pipeline & step registry — pipelines are code, not database rows,
registered once at import time from a module's AppConfig.ready(), the same
pattern as reporting.registry.register_report / automation.registry.register_source.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from shared.exceptions import NotFoundError


def default_backoff(attempt: int) -> float:
    """Exponential backoff, capped at 5 minutes."""
    return min(2**attempt, 300)


@dataclass(frozen=True)
class StepContext:
    tenant: Any
    run_id: str
    actor: Any
    data: dict[str, Any]
    attempt: int


@dataclass(frozen=True)
class StepResult:
    output: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StepDefinition:
    key: str
    label: str
    run: Callable[[StepContext], StepResult]
    compensate: Callable[[StepContext], None] | None = None
    max_attempts: int = 1
    backoff: Callable[[int], float] = default_backoff
    timeout_seconds: int = 300


@dataclass(frozen=True)
class PipelineDefinition:
    key: str
    label: str
    module: str
    permission: str
    version: int
    steps: list[StepDefinition]


_REGISTRY: dict[str, PipelineDefinition] = {}


def register_pipeline(definition: PipelineDefinition) -> None:
    _REGISTRY[definition.key] = definition


def get_pipeline(key: str) -> PipelineDefinition:
    definition = _REGISTRY.get(key)
    if definition is None:
        raise NotFoundError(f"Pipeline '{key}' is not registered.")
    return definition


def all_pipelines() -> list[PipelineDefinition]:
    return sorted(_REGISTRY.values(), key=lambda p: p.key)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_registry.py -v`
Expected: 4 passed.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/registry.py platform/tests/test_workflow_registry.py
git commit -m "feat(platform/workflow): add pipeline/step registry"
```

---

### Task 4: Engine — the atomic claim primitive

**Files:**

- Create: `platform/workflow/engine.py`
- Test: `platform/tests/test_workflow_engine.py`

**Interfaces:**

- Consumes: `workflow.models.{PipelineStepRun, StepRunStatus}` (Task 2).
- Produces: `_claim_step(step_id, *, from_status, to_status=StepRunStatus.RUNNING) -> bool`.

- [ ] **Step 1: Write the failing test**

`platform/tests/test_workflow_engine.py` (this file grows across Tasks 4–8):

```python
"""Pipeline engine — the atomic step-claim primitive, forward execution,
retries, compensation, crash recovery, and batch ticking."""

from __future__ import annotations

import pytest
from django.utils import timezone
from workflow.engine import _claim_step
from workflow.models import PipelineRun, PipelineStepRun, StepRunStatus

pytestmark = pytest.mark.django_db


def _make_run_with_step(tenant, *, step_status=StepRunStatus.PENDING) -> PipelineStepRun:
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key="test.pipeline")
    return PipelineStepRun.objects.create(
        tenant=tenant, run=run, step_index=0, step_key="a", status=step_status,
    )


def test_claim_succeeds_from_expected_status(tenant):
    step = _make_run_with_step(tenant)

    claimed = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert claimed is True
    step.refresh_from_db()
    assert step.status == StepRunStatus.RUNNING
    assert step.attempt == 1
    assert step.locked_at is not None


def test_claim_fails_from_unexpected_status(tenant):
    step = _make_run_with_step(tenant, step_status=StepRunStatus.SUCCESS)

    claimed = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert claimed is False
    step.refresh_from_db()
    assert step.status == StepRunStatus.SUCCESS  # unchanged


def test_concurrent_claim_only_one_caller_wins(tenant):
    step = _make_run_with_step(tenant)

    first = _claim_step(step.id, from_status=StepRunStatus.PENDING)
    second = _claim_step(step.id, from_status=StepRunStatus.PENDING)

    assert first is True
    assert second is False


def test_claim_supports_a_different_target_status(tenant):
    step = _make_run_with_step(tenant, step_status=StepRunStatus.SUCCESS)

    claimed = _claim_step(step.id, from_status=StepRunStatus.SUCCESS, to_status=StepRunStatus.COMPENSATING)

    assert claimed is True
    step.refresh_from_db()
    assert step.status == StepRunStatus.COMPENSATING
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'workflow.engine'`.

- [ ] **Step 3: Write the engine module (claim primitive only for now)**

`platform/workflow/engine.py`:

```python
"""Pipeline execution engine — advances one step at a time, so a crashed
process loses no state (see reclaim_stale_steps) and pause/resume/cancel are
just status flips the next tick honors. Full design rationale:
docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md
"""

from __future__ import annotations

import logging

from django.db.models import F
from django.utils import timezone

from workflow.models import PipelineStepRun, StepRunStatus

logger = logging.getLogger("platform.workflow")


def _claim_step(step_id, *, from_status: str, to_status: str = StepRunStatus.RUNNING) -> bool:
    """Atomically move one step from `from_status` to `to_status`.

    Returns True iff THIS call made the change. A single UPDATE...WHERE is
    atomic on both SQLite (the test backend) and Postgres (production), so
    exactly one of any number of racing callers wins — no lock table, no
    SELECT...FOR UPDATE (which is Postgres-only)."""
    updated = PipelineStepRun.objects.filter(id=step_id, status=from_status).update(
        status=to_status, attempt=F("attempt") + 1, locked_at=timezone.now()
    )
    return updated == 1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add platform/workflow/engine.py platform/tests/test_workflow_engine.py
git commit -m "feat(platform/workflow): add the atomic step-claim primitive"
```

---

### Task 5: Engine — forward execution (`advance_one`, retries, backoff)

**Files:**

- Modify: `platform/workflow/engine.py`
- Test: `platform/tests/test_workflow_engine.py` (append)

**Interfaces:**

- Consumes: `_claim_step` (Task 4), `workflow.registry.{StepContext, get_pipeline}` (Task 3), `workflow.models.{PipelineRun, PipelineRunStatus, TerminationReason, ACTIVE_STATUSES}` (Task 2).
- Produces: `AdvanceOutcome` enum, `advance_one(run, *, actor=None) -> AdvanceOutcome`, `_finish_run(run, status) -> AdvanceOutcome`, `_handle_step_failure(run, step_row, step_def, error, *, max_attempts=None) -> AdvanceOutcome`. Later tasks (6–8) call `advance_one` and `_finish_run`.

- [ ] **Step 1: Write the failing tests**

Append to `platform/tests/test_workflow_engine.py`:

```python
from workflow.engine import AdvanceOutcome, advance_one
from workflow.registry import PipelineDefinition, StepContext, StepDefinition, StepResult, register_pipeline
from workflow.models import PipelineRunStatus


def _register_single_step_pipeline(key, *, run, max_attempts=1, backoff=None):
    kwargs = dict(key="only", label="Only step", run=run, max_attempts=max_attempts)
    if backoff is not None:
        kwargs["backoff"] = backoff
    register_pipeline(PipelineDefinition(
        key=key, label="Test", module="test", permission="test.run", version=1,
        steps=[StepDefinition(**kwargs)],
    ))


def _start_run(tenant, pipeline_key, *, step_keys=("only",)) -> PipelineRun:
    run = PipelineRun.objects.create(tenant=tenant, pipeline_key=pipeline_key, step_keys=list(step_keys))
    for index, key in enumerate(step_keys):
        PipelineStepRun.objects.create(tenant=tenant, run=run, step_index=index, step_key=key)
    return run


def test_advance_one_runs_step_and_finishes_a_single_step_pipeline(tenant):
    _register_single_step_pipeline("test.advance.success", run=lambda ctx: StepResult(output={"ok": True}))
    run = _start_run(tenant, "test.advance.success")

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.STEP_SUCCEEDED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.RUNNING
    assert run.current_step_index == 1
    assert run.context == {"only": {"ok": True}}

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.RUN_FINISHED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS
    assert run.finished_at is not None


def test_advance_one_runs_multi_step_pipeline_in_order(tenant):
    order: list[str] = []

    def step_a(ctx: StepContext) -> StepResult:
        order.append("a")
        return StepResult(output={})

    def step_b(ctx: StepContext) -> StepResult:
        order.append("b")
        return StepResult(output={})

    register_pipeline(PipelineDefinition(
        key="test.advance.multi", label="Multi", module="test", permission="test.run", version=1,
        steps=[
            StepDefinition(key="a", label="A", run=step_a),
            StepDefinition(key="b", label="B", run=step_b),
        ],
    ))
    run = _start_run(tenant, "test.advance.multi", step_keys=("a", "b"))

    advance_one(run); run.refresh_from_db()
    advance_one(run); run.refresh_from_db()
    assert order == ["a", "b"]
    assert run.status == PipelineRunStatus.RUNNING  # 2 steps done, "no more steps" check not yet run

    advance_one(run); run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS


def test_step_failure_retries_up_to_max_attempts_respecting_backoff(tenant):
    calls = {"count": 0}

    def flaky(ctx: StepContext) -> StepResult:
        calls["count"] += 1
        raise RuntimeError("transient")

    _register_single_step_pipeline(
        "test.advance.retry", run=flaky, max_attempts=2, backoff=lambda attempt: 3600,
    )
    run = _start_run(tenant, "test.advance.retry")

    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.RETRYING
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING
    assert step.attempt == 1
    assert step.next_attempt_at > timezone.now()

    # Backoff hasn't elapsed (3600s) — a second tick right now must not retry yet.
    outcome = advance_one(run)
    assert outcome == AdvanceOutcome.NOT_DUE
    assert calls["count"] == 1


def test_step_failure_after_exhausted_retries_enters_compensating(tenant):
    def always_fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("permanent")

    _register_single_step_pipeline("test.advance.exhausted", run=always_fails, max_attempts=1)
    run = _start_run(tenant, "test.advance.exhausted")

    advance_one(run)
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING
    assert run.termination_reason == "failed"
    assert "permanent" in run.error_message
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.FAILED


def test_advance_one_is_a_noop_when_paused(tenant):
    _register_single_step_pipeline("test.advance.paused", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.advance.paused")
    run.status = PipelineRunStatus.PAUSED
    run.save(update_fields=["status"])

    outcome = advance_one(run)

    assert outcome == AdvanceOutcome.PAUSED
    step = run.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING  # untouched


def test_concurrent_finish_only_publishes_once(tenant, monkeypatch):
    """Two racing callers both discovering 'no more steps' must not both
    publish the completion event (and, in automation's later migration,
    must not both create an AutomationRun for the same rule execution)."""
    from workflow import engine

    published = []
    monkeypatch.setattr(engine, "publish", lambda event, **payload: published.append(event))

    _register_single_step_pipeline("test.advance.race", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.advance.race")
    advance_one(run)  # completes the only step
    run.refresh_from_db()

    # Two callers both see "no more steps" and both call _finish_run.
    from workflow.engine import _finish_run

    _finish_run(run, PipelineRunStatus.SUCCESS)
    _finish_run(run, PipelineRunStatus.SUCCESS)

    assert len(published) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: FAIL — `ImportError: cannot import name 'advance_one' from 'workflow.engine'`.

- [ ] **Step 3: Extend the engine module**

Replace `platform/workflow/engine.py` with:

```python
"""Pipeline execution engine — advances one step at a time, so a crashed
process loses no state (see reclaim_stale_steps) and pause/resume/cancel are
just status flips the next tick honors. Full design rationale:
docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md
"""

from __future__ import annotations

import logging
from datetime import timedelta
from enum import Enum

from django.db.models import F
from django.utils import timezone
from shared.events import Events, publish

from workflow.models import (
    ACTIVE_STATUSES,
    PipelineRun,
    PipelineRunStatus,
    PipelineStepRun,
    StepRunStatus,
    TerminationReason,
)
from workflow.registry import StepContext, get_pipeline

logger = logging.getLogger("platform.workflow")


class AdvanceOutcome(str, Enum):
    STEP_SUCCEEDED = "step_succeeded"
    RETRYING = "retrying"
    COMPENSATED = "compensated"
    RUN_FINISHED = "run_finished"
    PAUSED = "paused"
    NOT_DUE = "not_due"
    ALREADY_CLAIMED = "already_claimed"


def _claim_step(step_id, *, from_status: str, to_status: str = StepRunStatus.RUNNING) -> bool:
    """Atomically move one step from `from_status` to `to_status`.

    Returns True iff THIS call made the change. A single UPDATE...WHERE is
    atomic on both SQLite (the test backend) and Postgres (production), so
    exactly one of any number of racing callers wins — no lock table, no
    SELECT...FOR UPDATE (which is Postgres-only)."""
    updated = PipelineStepRun.objects.filter(id=step_id, status=from_status).update(
        status=to_status, attempt=F("attempt") + 1, locked_at=timezone.now()
    )
    return updated == 1


def _finish_run(run: PipelineRun, status: str) -> AdvanceOutcome:
    """Atomically transition a run to a terminal status and publish exactly
    once, even if multiple callers race to finish the same run (see
    test_concurrent_finish_only_publishes_once)."""
    updated = PipelineRun.objects.filter(id=run.id, status__in=ACTIVE_STATUSES).update(
        status=status, finished_at=timezone.now(), updated_at=timezone.now()
    )
    run.refresh_from_db()
    if updated:
        event = (
            Events.WORKFLOW_CANCELLED if status == PipelineRunStatus.CANCELLED
            else Events.WORKFLOW_COMPLETED
        )
        publish(event, instance=run)
    return AdvanceOutcome.RUN_FINISHED


def advance_one(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    """Advances exactly one step of `run`. Safe to call repeatedly and
    concurrently — see workflow/management/commands/pipeline_tick.py and
    workflow/services.py's run_to_completion for the two callers."""
    if run.status == PipelineRunStatus.PAUSED:
        return AdvanceOutcome.PAUSED
    if run.status == PipelineRunStatus.COMPENSATING:
        return _advance_compensation(run, actor=actor)

    definition = get_pipeline(run.pipeline_key)
    step_row = run.steps.filter(step_index=run.current_step_index).first()
    if step_row is None:
        return _finish_run(run, PipelineRunStatus.SUCCESS)

    if (
        step_row.status == StepRunStatus.PENDING
        and step_row.next_attempt_at is not None
        and step_row.next_attempt_at > timezone.now()
    ):
        return AdvanceOutcome.NOT_DUE

    if not _claim_step(step_row.id, from_status=StepRunStatus.PENDING):
        return AdvanceOutcome.ALREADY_CLAIMED

    step_row.refresh_from_db()
    if run.status == PipelineRunStatus.QUEUED:
        run.status = PipelineRunStatus.RUNNING
        run.started_at = run.started_at or timezone.now()
        run.save(update_fields=["status", "started_at", "updated_at"])

    step_def = next((s for s in definition.steps if s.key == step_row.step_key), None)
    if step_def is None:
        return _handle_step_failure(
            run, step_row, None,
            f"Step '{step_row.step_key}' is no longer registered on pipeline '{run.pipeline_key}'.",
            max_attempts=step_row.attempt,  # never retry — the definition is gone
        )

    ctx = StepContext(
        tenant=run.tenant, run_id=str(run.id), actor=actor, data=dict(run.context),
        attempt=step_row.attempt,
    )
    try:
        result = step_def.run(ctx)
    except Exception as exc:  # noqa: BLE001 - a step's own failure, handled below
        return _handle_step_failure(run, step_row, step_def, str(exc))

    step_row.status = StepRunStatus.SUCCESS
    step_row.finished_at = timezone.now()
    step_row.output = result.output
    step_row.locked_at = None
    step_row.save(update_fields=["status", "finished_at", "output", "locked_at", "updated_at"])

    run.context = {**run.context, step_row.step_key: result.output}
    run.current_step_index += 1
    run.save(update_fields=["context", "current_step_index", "updated_at"])
    return AdvanceOutcome.STEP_SUCCEEDED


def _handle_step_failure(
    run: PipelineRun, step_row: PipelineStepRun, step_def, error: str, *, max_attempts: int | None = None,
) -> AdvanceOutcome:
    limit = max_attempts if max_attempts is not None else (step_def.max_attempts if step_def else 1)
    step_row.error_message = error
    if step_row.attempt < limit:
        step_row.status = StepRunStatus.PENDING
        step_row.locked_at = None
        delay = step_def.backoff(step_row.attempt) if step_def else 0
        step_row.next_attempt_at = timezone.now() + timedelta(seconds=delay)
        step_row.save(
            update_fields=["status", "locked_at", "next_attempt_at", "error_message", "updated_at"]
        )
        return AdvanceOutcome.RETRYING

    step_row.status = StepRunStatus.FAILED
    step_row.finished_at = timezone.now()
    step_row.locked_at = None
    step_row.save(update_fields=["status", "finished_at", "locked_at", "error_message", "updated_at"])

    run.termination_reason = TerminationReason.FAILED
    run.status = PipelineRunStatus.COMPENSATING
    run.error_message = error
    run.save(update_fields=["termination_reason", "status", "error_message", "updated_at"])
    return AdvanceOutcome.RETRYING


def _advance_compensation(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    raise NotImplementedError  # implemented in Task 6
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: all pass (the compensation-path test from Task 6 doesn't exist yet, so nothing here exercises `_advance_compensation`).

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/engine.py platform/tests/test_workflow_engine.py
git commit -m "feat(platform/workflow): forward execution with retry/backoff"
```

---

### Task 6: Engine — compensation (rollback)

**Files:**

- Modify: `platform/workflow/engine.py`
- Test: `platform/tests/test_workflow_engine.py` (append)

**Interfaces:**

- Consumes: `_claim_step`, `_finish_run`, `StepContext` (all from Task 5).
- Produces: real `_advance_compensation(run, *, actor=None) -> AdvanceOutcome` (replaces the `NotImplementedError` stub).

- [ ] **Step 1: Write the failing tests**

Append to `platform/tests/test_workflow_engine.py`:

```python
def test_compensation_runs_prior_successful_steps_in_reverse_order(tenant):
    compensated: list[str] = []

    def make_step(key, *, fail=False):
        def run(ctx: StepContext) -> StepResult:
            if fail:
                raise RuntimeError("boom")
            return StepResult(output={})

        def compensate(ctx: StepContext) -> None:
            compensated.append(key)

        return StepDefinition(key=key, label=key, run=run, compensate=compensate, max_attempts=1)

    register_pipeline(PipelineDefinition(
        key="test.compensate.order", label="Order", module="test", permission="test.run", version=1,
        steps=[make_step("a"), make_step("b"), make_step("c", fail=True)],
    ))
    run = _start_run(tenant, "test.compensate.order", step_keys=("a", "b", "c"))

    advance_one(run); run.refresh_from_db()  # a succeeds
    advance_one(run); run.refresh_from_db()  # b succeeds
    advance_one(run); run.refresh_from_db()  # c fails, exhausts retries -> COMPENSATING
    assert run.status == PipelineRunStatus.COMPENSATING

    advance_one(run); run.refresh_from_db()  # unwind b
    advance_one(run); run.refresh_from_db()  # unwind a
    advance_one(run); run.refresh_from_db()  # nothing left -> FAILED

    assert compensated == ["b", "a"]
    assert run.status == PipelineRunStatus.FAILED
    assert run.steps.get(step_key="c").status == StepRunStatus.FAILED
    assert run.steps.get(step_key="b").status == StepRunStatus.COMPENSATED
    assert run.steps.get(step_key="a").status == StepRunStatus.COMPENSATED


def test_compensation_error_on_one_step_does_not_block_unwinding_earlier_steps(tenant):
    def ok_run(ctx: StepContext) -> StepResult:
        return StepResult(output={})

    def failing_compensate(ctx: StepContext) -> None:
        raise RuntimeError("compensate failed")

    def fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("boom")

    register_pipeline(PipelineDefinition(
        key="test.compensate.partial", label="Partial", module="test", permission="test.run", version=1,
        steps=[
            StepDefinition(key="a", label="a", run=ok_run, compensate=lambda ctx: None),
            StepDefinition(key="b", label="b", run=ok_run, compensate=failing_compensate),
            StepDefinition(key="c", label="c", run=fails, max_attempts=1),
        ],
    ))
    run = _start_run(tenant, "test.compensate.partial", step_keys=("a", "b", "c"))
    advance_one(run); run.refresh_from_db()
    advance_one(run); run.refresh_from_db()
    advance_one(run); run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING

    advance_one(run); run.refresh_from_db()  # unwind b -> fails
    advance_one(run); run.refresh_from_db()  # unwind a -> succeeds anyway
    advance_one(run); run.refresh_from_db()  # finish

    assert run.steps.get(step_key="b").status == StepRunStatus.COMPENSATION_FAILED
    assert run.steps.get(step_key="a").status == StepRunStatus.COMPENSATED
    assert run.status == PipelineRunStatus.FAILED


def test_cancelling_a_run_lands_on_cancelled_not_failed(tenant):
    _register_single_step_pipeline("test.compensate.cancel", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.compensate.cancel")
    advance_one(run); run.refresh_from_db()  # only step succeeds, run still RUNNING

    run.status = PipelineRunStatus.COMPENSATING
    run.termination_reason = "cancelled"
    run.save(update_fields=["status", "termination_reason"])

    advance_one(run); run.refresh_from_db()  # unwind the one succeeded step
    advance_one(run); run.refresh_from_db()  # finish

    assert run.status == PipelineRunStatus.CANCELLED
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v -k compensat`
Expected: FAIL — `NotImplementedError`.

- [ ] **Step 3: Implement `_advance_compensation`**

In `platform/workflow/engine.py`, replace:

```python
def _advance_compensation(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    raise NotImplementedError  # implemented in Task 6
```

with:

```python
def _advance_compensation(run: PipelineRun, *, actor=None) -> AdvanceOutcome:
    next_row = run.steps.filter(status=StepRunStatus.SUCCESS).order_by("-step_index").first()
    if next_row is None:
        run.steps.filter(status=StepRunStatus.PENDING).update(status=StepRunStatus.SKIPPED)
        final = (
            PipelineRunStatus.CANCELLED
            if run.termination_reason == TerminationReason.CANCELLED
            else PipelineRunStatus.FAILED
        )
        return _finish_run(run, final)

    if not _claim_step(
        next_row.id, from_status=StepRunStatus.SUCCESS, to_status=StepRunStatus.COMPENSATING
    ):
        return AdvanceOutcome.ALREADY_CLAIMED

    definition = get_pipeline(run.pipeline_key)
    step_def = next((s for s in definition.steps if s.key == next_row.step_key), None)
    ctx = StepContext(
        tenant=run.tenant, run_id=str(run.id), actor=actor, data=dict(run.context),
        attempt=next_row.attempt,
    )
    try:
        if step_def is not None and step_def.compensate is not None:
            step_def.compensate(ctx)
        next_row.status = StepRunStatus.COMPENSATED
    except Exception as exc:  # noqa: BLE001 - logged; unwind of earlier steps still continues
        next_row.status = StepRunStatus.COMPENSATION_FAILED
        next_row.error_message = str(exc)
        logger.exception("Compensation failed for step %s of run %s", next_row.step_key, run.id)
    next_row.finished_at = timezone.now()
    next_row.locked_at = None
    next_row.save(update_fields=["status", "error_message", "finished_at", "locked_at", "updated_at"])
    return AdvanceOutcome.COMPENSATED
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: all pass.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/engine.py platform/tests/test_workflow_engine.py
git commit -m "feat(platform/workflow): compensation (rollback) unwind"
```

---

### Task 7: Engine — crash recovery (`reclaim_stale_steps`)

**Files:**

- Modify: `platform/workflow/engine.py`
- Test: `platform/tests/test_workflow_engine.py` (append)

**Interfaces:**

- Consumes: `PipelineRun`, `PipelineStepRun`, `PipelineRunStatus`, `StepRunStatus`, `TerminationReason` (Task 2); `workflow.registry.get_pipeline` (Task 3).
- Produces: `reclaim_stale_steps() -> int`.

- [ ] **Step 1: Write the failing tests**

Append to `platform/tests/test_workflow_engine.py`:

```python
from datetime import timedelta

from workflow.engine import reclaim_stale_steps


def test_reclaim_resets_stale_running_step_to_pending_when_attempts_remain(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 60
    _register_single_step_pipeline("test.reclaim.retry", run=lambda ctx: StepResult(), max_attempts=3)
    run = _start_run(tenant, "test.reclaim.retry")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.attempt = 1
    step.locked_at = timezone.now() - timedelta(seconds=120)
    step.save()

    reclaimed = reclaim_stale_steps()

    assert reclaimed == 1
    step.refresh_from_db()
    assert step.status == StepRunStatus.PENDING
    assert step.locked_at is None
    assert "stale lock" in step.error_message


def test_reclaim_fails_run_when_attempts_exhausted(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 60
    _register_single_step_pipeline("test.reclaim.exhausted", run=lambda ctx: StepResult(), max_attempts=1)
    run = _start_run(tenant, "test.reclaim.exhausted")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.attempt = 1  # == max_attempts, no retries left
    step.locked_at = timezone.now() - timedelta(seconds=120)
    step.save()

    reclaim_stale_steps()

    step.refresh_from_db()
    assert step.status == StepRunStatus.FAILED
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.COMPENSATING
    assert run.termination_reason == "failed"


def test_reclaim_ignores_steps_within_the_timeout_window(tenant, settings):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 3600
    _register_single_step_pipeline("test.reclaim.fresh", run=lambda ctx: StepResult())
    run = _start_run(tenant, "test.reclaim.fresh")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.locked_at = timezone.now()  # just claimed, well within the timeout
    step.save()

    reclaimed = reclaim_stale_steps()

    assert reclaimed == 0
    step.refresh_from_db()
    assert step.status == StepRunStatus.RUNNING
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v -k reclaim`
Expected: FAIL — `ImportError: cannot import name 'reclaim_stale_steps'`.

- [ ] **Step 3: Implement `reclaim_stale_steps`**

In `platform/workflow/engine.py`, add near the top of the imports:

```python
from django.conf import settings
```

Then append at the end of the file:

```python
def reclaim_stale_steps() -> int:
    """Crash recovery: any step still RUNNING past its own timeout almost
    certainly means the process executing it crashed or was killed. Reset
    it to PENDING (if retries remain) or drive its run into COMPENSATING
    (if exhausted) — no special recovery process, just a check run at the
    top of every tick (see tick_all, Task 8)."""
    stale = PipelineStepRun.objects.filter(status=StepRunStatus.RUNNING, locked_at__isnull=False)
    reclaimed = 0
    for step_row in stale.iterator():
        try:
            definition = get_pipeline(step_row.run.pipeline_key)
            step_def = next((s for s in definition.steps if s.key == step_row.step_key), None)
        except Exception:  # noqa: BLE001 - unknown pipeline key; fall back to the default timeout
            step_def = None
        timeout = step_def.timeout_seconds if step_def else settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS
        if step_row.locked_at > timezone.now() - timedelta(seconds=timeout):
            continue

        can_retry = step_def is not None and step_row.attempt < step_def.max_attempts
        updated = PipelineStepRun.objects.filter(
            id=step_row.id, status=StepRunStatus.RUNNING, locked_at=step_row.locked_at
        ).update(
            status=StepRunStatus.PENDING if can_retry else StepRunStatus.FAILED,
            locked_at=None,
            error_message="Reclaimed after a stale lock (the process running this step likely crashed).",
        )
        if updated and not can_retry:
            run = PipelineRun.objects.get(id=step_row.run_id)
            run.termination_reason = TerminationReason.FAILED
            run.status = PipelineRunStatus.COMPENSATING
            run.save(update_fields=["termination_reason", "status", "updated_at"])
        reclaimed += updated
    return reclaimed
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: all pass.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/engine.py platform/tests/test_workflow_engine.py
git commit -m "feat(platform/workflow): crash recovery via stale-lock reclaim"
```

---

### Task 8: Engine — batch ticking (`tick_all`)

**Files:**

- Modify: `platform/workflow/engine.py`
- Test: `platform/tests/test_workflow_engine.py` (append)

**Interfaces:**

- Consumes: `advance_one`, `reclaim_stale_steps` (Tasks 5, 7); `workflow.models.ACTIVE_STATUSES` (Task 2).
- Produces: `TickSummary(advanced, reclaimed)`, `tick_all(*, tenant=None, batch_size=None, actor=None) -> TickSummary`.

- [ ] **Step 1: Write the failing tests**

Append to `platform/tests/test_workflow_engine.py`:

```python
from workflow.engine import tick_all


def test_tick_all_advances_every_active_run_across_tenants(tenant, other_tenant):
    _register_single_step_pipeline("test.tick.multi", run=lambda ctx: StepResult())
    run_a = _start_run(tenant, "test.tick.multi")
    run_b = _start_run(other_tenant, "test.tick.multi")

    summary = tick_all()

    assert summary.advanced == 2
    run_a.refresh_from_db()
    run_b.refresh_from_db()
    assert run_a.current_step_index == 1
    assert run_b.current_step_index == 1


def test_tick_all_can_be_scoped_to_one_tenant(tenant, other_tenant):
    _register_single_step_pipeline("test.tick.scoped", run=lambda ctx: StepResult())
    run_a = _start_run(tenant, "test.tick.scoped")
    run_b = _start_run(other_tenant, "test.tick.scoped")

    tick_all(tenant=tenant)

    run_a.refresh_from_db()
    run_b.refresh_from_db()
    assert run_a.current_step_index == 1
    assert run_b.current_step_index == 0  # untouched


def test_tick_all_isolates_one_broken_run_from_the_rest(tenant, monkeypatch):
    _register_single_step_pipeline("test.tick.isolate", run=lambda ctx: StepResult())
    healthy = _start_run(tenant, "test.tick.isolate")
    broken = _start_run(tenant, "test.tick.isolate")

    from workflow import engine

    real_advance_one = engine.advance_one

    def flaky_advance_one(run, **kwargs):
        if run.id == broken.id:
            raise RuntimeError("engine bug, not a step failure")
        return real_advance_one(run, **kwargs)

    monkeypatch.setattr(engine, "advance_one", flaky_advance_one)

    summary = engine.tick_all()

    assert summary.advanced == 1  # only the healthy run
    healthy.refresh_from_db()
    broken.refresh_from_db()
    assert healthy.current_step_index == 1
    assert broken.current_step_index == 0
    assert broken.status == PipelineRunStatus.QUEUED  # left untouched, not marked failed


def test_tick_all_runs_reclaim_first(tenant, settings, monkeypatch):
    settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS = 60
    _register_single_step_pipeline("test.tick.reclaim", run=lambda ctx: StepResult(), max_attempts=2)
    run = _start_run(tenant, "test.tick.reclaim")
    step = run.steps.get(step_index=0)
    step.status = StepRunStatus.RUNNING
    step.attempt = 1
    step.locked_at = timezone.now() - timedelta(seconds=120)
    step.save()

    summary = tick_all()

    assert summary.reclaimed == 1
    step.refresh_from_db()
    assert step.status == StepRunStatus.SUCCESS  # reclaimed to PENDING, then advanced in the same tick
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v -k tick_all`
Expected: FAIL — `ImportError: cannot import name 'tick_all'`.

- [ ] **Step 3: Implement `tick_all`**

In `platform/workflow/engine.py`, add `from dataclasses import dataclass` to the imports (alongside `from enum import Enum`), then append at the end of the file:

```python
@dataclass
class TickSummary:
    advanced: int
    reclaimed: int


def tick_all(*, tenant=None, batch_size: int | None = None, actor=None) -> TickSummary:
    """Advances every active run once. Called by pipeline_tick (Task 11).
    Runs across ALL tenants implicitly when `tenant` is None — a bare
    management-command process has no request-scoped thread-local tenant
    context, so TenantOwnedModel's manager doesn't filter (see
    shared/models.py's TenantManager); this is documented existing
    behavior, not a bug (see test_tick_all_advances_every_active_run_across_tenants)."""
    reclaimed = reclaim_stale_steps()
    qs = PipelineRun.objects.filter(status__in=ACTIVE_STATUSES)
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    advanced = 0
    limit = batch_size or settings.PIPELINE_TICK_BATCH_SIZE
    for run in qs.order_by("queued_at")[:limit]:
        try:
            advance_one(run, actor=actor)
            advanced += 1
        except Exception:  # noqa: BLE001 - an engine bug must not stop other runs from ticking
            logger.exception("tick_all: error advancing run %s — left as-is for the next tick", run.id)
    return TickSummary(advanced=advanced, reclaimed=reclaimed)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_engine.py -v`
Expected: all pass (the full `test_workflow_engine.py` file, all tasks 4–8, should now be ~20 tests, all green).

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green. The engine is now feature-complete.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/engine.py platform/tests/test_workflow_engine.py
git commit -m "feat(platform/workflow): batch ticking across all active runs"
```

---

### Task 9: `PipelineService`

**Files:**

- Create: `platform/workflow/services.py`
- Test: `platform/tests/test_workflow_service.py`

**Interfaces:**

- Consumes: `workflow.engine.advance_one` (Task 5), `workflow.registry.get_pipeline` (Task 3), `workflow.models.*` (Task 2).
- Produces: `PipelineService.start(*, pipeline_key, tenant, actor=None, trigger_type="manual", idempotency_key="", source_module="", source_object_type="", source_object_id="", input_data=None) -> tuple[PipelineRun, bool]`, `.run_to_completion(run, *, actor=None, max_wall_seconds=30.0) -> PipelineRun`, `.get_run(run_id) -> PipelineRun`, `.request_pause(run) -> PipelineRun`, `.request_resume(run) -> PipelineRun`, `.request_cancel(run) -> PipelineRun`, `.request_retry(run) -> PipelineRun`.

- [ ] **Step 1: Write the failing tests**

`platform/tests/test_workflow_service.py`:

```python
"""PipelineService — starting runs (with idempotency dedup), synchronous
draining, and the pause/resume/cancel/retry control-plane actions."""

from __future__ import annotations

import pytest
from shared.exceptions import ConflictError
from workflow.models import PipelineRun, PipelineRunStatus, StepRunStatus
from workflow.registry import PipelineDefinition, StepContext, StepDefinition, StepResult, register_pipeline
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db


def _register(key, *, run=None, max_attempts=1):
    register_pipeline(PipelineDefinition(
        key=key, label="Test", module="test", permission="test.run", version=1,
        steps=[StepDefinition(key="only", label="Only", run=run or (lambda ctx: StepResult()), max_attempts=max_attempts)],
    ))


def test_start_creates_run_and_snapshots_step_keys(tenant):
    _register("test.service.start")

    run, created = PipelineService().start(pipeline_key="test.service.start", tenant=tenant)

    assert created is True
    assert run.step_keys == ["only"]
    assert run.steps.count() == 1
    assert run.status == PipelineRunStatus.QUEUED


def test_start_with_idempotency_key_dedupes_concurrent_callers(tenant):
    _register("test.service.idempotent")

    run1, created1 = PipelineService().start(
        pipeline_key="test.service.idempotent", tenant=tenant, idempotency_key="same-key",
    )
    run2, created2 = PipelineService().start(
        pipeline_key="test.service.idempotent", tenant=tenant, idempotency_key="same-key",
    )

    assert created1 is True
    assert created2 is False
    assert run1.id == run2.id
    assert PipelineRun.objects.filter(pipeline_key="test.service.idempotent").count() == 1


def test_start_without_idempotency_key_never_dedupes(tenant):
    _register("test.service.manual")

    run1, _ = PipelineService().start(pipeline_key="test.service.manual", tenant=tenant)
    run2, _ = PipelineService().start(pipeline_key="test.service.manual", tenant=tenant)

    assert run1.id != run2.id


def test_run_to_completion_drains_a_pipeline_synchronously(tenant):
    _register("test.service.drain", run=lambda ctx: StepResult(output={"done": True}))
    run, _ = PipelineService().start(pipeline_key="test.service.drain", tenant=tenant)

    finished = PipelineService().run_to_completion(run)

    assert finished.status == PipelineRunStatus.SUCCESS
    assert finished.context == {"only": {"done": True}}


def test_pause_only_valid_from_queued_or_running(tenant):
    _register("test.service.pause")
    run, _ = PipelineService().start(pipeline_key="test.service.pause", tenant=tenant)

    paused = PipelineService().request_pause(run)
    assert paused.status == PipelineRunStatus.PAUSED

    with pytest.raises(ConflictError):
        PipelineService().request_pause(paused)  # already paused


def test_resume_moves_paused_back_to_queued_or_running(tenant):
    _register("test.service.resume")
    run, _ = PipelineService().start(pipeline_key="test.service.resume", tenant=tenant)
    paused = PipelineService().request_pause(run)

    resumed = PipelineService().request_resume(paused)

    assert resumed.status == PipelineRunStatus.QUEUED  # never started_at, so resumes to QUEUED


def test_resume_on_a_non_paused_run_raises(tenant):
    _register("test.service.resume2")
    run, _ = PipelineService().start(pipeline_key="test.service.resume2", tenant=tenant)

    with pytest.raises(ConflictError):
        PipelineService().request_resume(run)


def test_cancel_routes_through_compensating(tenant):
    _register("test.service.cancel")
    run, _ = PipelineService().start(pipeline_key="test.service.cancel", tenant=tenant)

    cancelled = PipelineService().request_cancel(run)

    assert cancelled.status == PipelineRunStatus.COMPENSATING
    assert cancelled.termination_reason == "cancelled"


def test_retry_only_valid_from_failed(tenant):
    _register("test.service.retry")
    run, _ = PipelineService().start(pipeline_key="test.service.retry", tenant=tenant)

    with pytest.raises(ConflictError):
        PipelineService().request_retry(run)  # still QUEUED, not FAILED


def test_retry_rearms_failed_and_skipped_steps(tenant):
    def always_fails(ctx: StepContext) -> StepResult:
        raise RuntimeError("boom")

    _register("test.service.retry2", run=always_fails, max_attempts=1)
    run, _ = PipelineService().start(pipeline_key="test.service.retry2", tenant=tenant)
    finished = PipelineService().run_to_completion(run)
    assert finished.status == PipelineRunStatus.FAILED

    retried = PipelineService().request_retry(finished)

    assert retried.status == PipelineRunStatus.QUEUED
    step = retried.steps.get(step_index=0)
    assert step.status == StepRunStatus.PENDING
    assert step.error_message == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'workflow.services'`.

- [ ] **Step 3: Write the service**

`platform/workflow/services.py`:

```python
"""Pipeline control-plane: starting runs, draining them synchronously for
callers that need a blocking result today (automation's run_rule, Task 14),
and the pause/resume/cancel/retry actions an operator can take on a running
pipeline via the API (Task 10).
"""

from __future__ import annotations

import time

from django.utils import timezone
from shared.exceptions import ConflictError
from shared.services import BaseService

from workflow.engine import advance_one
from workflow.models import (
    TERMINAL_STATUSES,
    PipelineRun,
    PipelineRunStatus,
    PipelineStepRun,
    StepRunStatus,
    TerminationReason,
)
from workflow.registry import get_pipeline


class PipelineService(BaseService):
    def start(
        self,
        *,
        pipeline_key: str,
        tenant,
        actor=None,
        trigger_type: str = "manual",
        idempotency_key: str = "",
        source_module: str = "",
        source_object_type: str = "",
        source_object_id: str = "",
        input_data: dict | None = None,
    ) -> tuple[PipelineRun, bool]:
        definition = get_pipeline(pipeline_key)  # NotFoundError if unknown — fail loudly
        fields = {
            "pipeline_version": definition.version,
            "step_keys": [s.key for s in definition.steps],
            "trigger_type": trigger_type,
            "triggered_by": actor,
            "source_module": source_module,
            "source_object_type": source_object_type,
            "source_object_id": source_object_id,
            "context": input_data or {},
        }
        if idempotency_key:
            run, created = PipelineRun.objects.get_or_create(
                tenant=tenant, pipeline_key=pipeline_key, idempotency_key=idempotency_key,
                defaults=fields,
            )
        else:
            run = PipelineRun.objects.create(
                tenant=tenant, pipeline_key=pipeline_key, idempotency_key="", **fields
            )
            created = True

        if created:
            for index, step in enumerate(definition.steps):
                PipelineStepRun.objects.create(
                    tenant=tenant, run=run, step_index=index, step_key=step.key
                )
        return run, created

    def run_to_completion(
        self, run: PipelineRun, *, actor=None, max_wall_seconds: float = 30.0
    ) -> PipelineRun:
        """Drains a run tick-by-tick in this process until it reaches a
        terminal state. The exact same advance_one() primitive a future
        incremental tick loop uses — no separate 'sync mode' execution
        path to keep correct alongside the real one."""
        deadline = time.monotonic() + max_wall_seconds
        while True:
            run.refresh_from_db()
            if run.status in TERMINAL_STATUSES:
                return run
            advance_one(run, actor=actor)
            if time.monotonic() > deadline:
                raise ConflictError(f"Pipeline run {run.id} did not finish within {max_wall_seconds}s.")

    def get_run(self, run_id) -> PipelineRun:
        return PipelineRun.objects.get(id=run_id)

    def request_pause(self, run: PipelineRun) -> PipelineRun:
        updated = PipelineRun.objects.filter(
            id=run.id, status__in=[PipelineRunStatus.QUEUED, PipelineRunStatus.RUNNING]
        ).update(status=PipelineRunStatus.PAUSED, updated_at=timezone.now())
        if not updated:
            raise ConflictError("Only a queued or running pipeline can be paused.")
        run.refresh_from_db()
        return run

    def request_resume(self, run: PipelineRun) -> PipelineRun:
        next_status = PipelineRunStatus.RUNNING if run.started_at else PipelineRunStatus.QUEUED
        updated = PipelineRun.objects.filter(id=run.id, status=PipelineRunStatus.PAUSED).update(
            status=next_status, updated_at=timezone.now()
        )
        if not updated:
            raise ConflictError("Only a paused pipeline can be resumed.")
        run.refresh_from_db()
        return run

    def request_cancel(self, run: PipelineRun) -> PipelineRun:
        updated = PipelineRun.objects.filter(
            id=run.id,
            status__in=[PipelineRunStatus.QUEUED, PipelineRunStatus.RUNNING, PipelineRunStatus.PAUSED],
        ).update(
            status=PipelineRunStatus.COMPENSATING,
            termination_reason=TerminationReason.CANCELLED,
            updated_at=timezone.now(),
        )
        if not updated:
            raise ConflictError("Only a queued, running, or paused pipeline can be cancelled.")
        run.refresh_from_db()
        return run

    def request_retry(self, run: PipelineRun) -> PipelineRun:
        if run.status != PipelineRunStatus.FAILED:
            raise ConflictError("Only a failed pipeline can be retried.")
        run.steps.filter(status__in=[StepRunStatus.FAILED, StepRunStatus.SKIPPED]).update(
            status=StepRunStatus.PENDING, next_attempt_at=None, error_message="",
        )
        run.status = PipelineRunStatus.QUEUED
        run.termination_reason = TerminationReason.NONE
        run.error_message = ""
        run.save(update_fields=["status", "termination_reason", "error_message", "updated_at"])
        return run
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_service.py -v`
Expected: 10 passed.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/services.py platform/tests/test_workflow_service.py
git commit -m "feat(platform/workflow): PipelineService control plane"
```

---

### Task 10: API (serializers, views, urls)

**Files:**

- Create: `platform/workflow/serializers.py`, `platform/workflow/views.py`, `platform/workflow/urls.py`
- Modify: `platform/config/urls.py`
- Test: `platform/tests/test_workflow_api.py`

**Interfaces:**

- Consumes: `PipelineService` (Task 9), `workflow.models.*` (Task 2), `shared.views.ReadOnlyModelViewSet`, `shared.serializers.BaseModelSerializer` (existing platform conventions).
- Produces: `GET/POST /api/v1/workflow/runs/`, `.../{id}/`, `.../{id}/pause/`, `.../{id}/resume/`, `.../{id}/cancel/`, `.../{id}/retry/`.

- [ ] **Step 1: Write the failing tests**

`platform/tests/test_workflow_api.py`:

```python
"""Pipeline run API — read access and the pause/resume/cancel/retry
control-plane actions, with permission checks."""

from __future__ import annotations

import pytest
from workflow.models import PipelineRunStatus
from workflow.registry import PipelineDefinition, StepDefinition, StepResult, register_pipeline
from workflow.services import PipelineService

pytestmark = pytest.mark.django_db

RUNS_URL = "/api/v1/workflow/runs/"


@pytest.fixture(autouse=True)
def _register_test_pipeline():
    register_pipeline(PipelineDefinition(
        key="test.api.pipeline", label="Test", module="test", permission="test.run", version=1,
        steps=[StepDefinition(key="only", label="Only", run=lambda ctx: StepResult(), max_attempts=1)],
    ))


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def test_list_requires_authentication(api):
    response = api.get(RUNS_URL)
    assert response.status_code == 401


def test_owner_can_list_and_retrieve_runs(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)

    client = auth_client(owner)
    listed = client.get(RUNS_URL)
    assert listed.status_code == 200
    assert any(r["id"] == str(run.id) for r in listed.data["results"])

    detail = client.get(f"{RUNS_URL}{run.id}/")
    assert detail.status_code == 200
    assert detail.data["pipeline_key"] == "test.api.pipeline"
    assert len(detail.data["steps"]) == 1


def test_pause_resume_cancel_retry_actions(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)
    client = auth_client(owner)

    paused = client.post(f"{RUNS_URL}{run.id}/pause/")
    assert paused.status_code == 200
    assert paused.data["status"] == PipelineRunStatus.PAUSED

    resumed = client.post(f"{RUNS_URL}{run.id}/resume/")
    assert resumed.status_code == 200
    assert resumed.data["status"] == PipelineRunStatus.QUEUED

    cancelled = client.post(f"{RUNS_URL}{run.id}/cancel/")
    assert cancelled.status_code == 200
    assert cancelled.data["status"] == PipelineRunStatus.COMPENSATING


def test_pause_on_already_paused_run_returns_409(tenant, owner, auth_client):
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)
    client = auth_client(owner)
    client.post(f"{RUNS_URL}{run.id}/pause/")

    response = client.post(f"{RUNS_URL}{run.id}/pause/")

    assert response.status_code == 409


def test_control_actions_require_workflow_control_permission(
    tenant, make_user, make_role, grant, auth_client,
):
    viewer = make_user(email="viewer@acme.test", username="viewer", tenant=tenant)
    grant(viewer, make_role(tenant, "viewer", ["workflow.view"]))
    run, _ = PipelineService().start(pipeline_key="test.api.pipeline", tenant=tenant)

    response = auth_client(viewer).post(f"{RUNS_URL}{run.id}/pause/")

    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_api.py -v`
Expected: FAIL — 404s (no `/workflow/` URL mounted yet).

- [ ] **Step 3: Write serializers, views, urls**

`platform/workflow/serializers.py`:

```python
"""Pipeline run API serializers."""

from __future__ import annotations

from shared.serializers import BaseModelSerializer

from workflow.models import PipelineRun, PipelineStepRun


class PipelineStepRunSerializer(BaseModelSerializer):
    class Meta:
        model = PipelineStepRun
        fields = (
            "id",
            "step_index",
            "step_key",
            "status",
            "attempt",
            "started_at",
            "finished_at",
            "output",
            "error_message",
        )
        read_only_fields = fields


class PipelineRunSerializer(BaseModelSerializer):
    steps = PipelineStepRunSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineRun
        fields = (
            "id",
            "pipeline_key",
            "pipeline_version",
            "status",
            "termination_reason",
            "current_step_index",
            "trigger_type",
            "source_module",
            "source_object_type",
            "source_object_id",
            "queued_at",
            "started_at",
            "finished_at",
            "error_message",
            "steps",
            "created_at",
        )
        read_only_fields = fields
```

`platform/workflow/views.py`:

```python
"""Pipeline run API — read access plus the pause/resume/cancel/retry
control-plane actions."""

from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import ReadOnlyModelViewSet

from workflow.models import PipelineRun
from workflow.serializers import PipelineRunSerializer
from workflow.services import PipelineService


class PipelineRunViewSet(ReadOnlyModelViewSet):
    serializer_class = PipelineRunSerializer
    filterset_fields = ("pipeline_key", "status", "trigger_type")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "workflow.view",
        "retrieve": "workflow.view",
        "pause": "workflow.control",
        "resume": "workflow.control",
        "cancel": "workflow.control",
        "retry": "workflow.control",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PipelineRun.objects.none()
        user = self.request.user
        qs = PipelineRun.objects.prefetch_related("steps")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=True, methods=["post"])
    def pause(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_pause(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def resume(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_resume(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_cancel(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def retry(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_retry(self.get_object())
        return Response(PipelineRunSerializer(run).data)
```

`platform/workflow/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from workflow.views import PipelineRunViewSet

router = DefaultRouter()
router.register("runs", PipelineRunViewSet, basename="pipeline-run")

urlpatterns = router.urls
```

In `platform/config/urls.py`, add `path("workflow/", include("workflow.urls")),` immediately before `path("automation/", include("automation.urls")),`:

```python
    path("tags/", include("tagging.urls")),
    path("workflow/", include("workflow.urls")),
    path("automation/", include("automation.urls")),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_api.py -v`
Expected: 6 passed.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/serializers.py platform/workflow/views.py platform/workflow/urls.py platform/config/urls.py platform/tests/test_workflow_api.py
git commit -m "feat(platform/workflow): pipeline run API with pause/resume/cancel/retry"
```

---

### Task 11: `pipeline_tick` management command

**Files:**

- Create: `platform/workflow/management/__init__.py`, `platform/workflow/management/commands/__init__.py`, `platform/workflow/management/commands/pipeline_tick.py`
- Test: append to `platform/tests/test_workflow_service.py` (a thin smoke test — the engine logic itself is already fully covered by Tasks 4–8)

**Interfaces:**

- Consumes: `workflow.engine.tick_all` (Task 8).
- Produces: `python manage.py pipeline_tick` (one-shot) and `python manage.py pipeline_tick --loop --interval N`.

- [ ] **Step 1: Write the failing test**

Append to `platform/tests/test_workflow_service.py`:

```python
from io import StringIO

from django.core.management import call_command


def test_pipeline_tick_command_advances_due_runs(tenant):
    _register("test.command.tick")
    run, _ = PipelineService().start(pipeline_key="test.command.tick", tenant=tenant)

    out = StringIO()
    call_command("pipeline_tick", stdout=out)

    run.refresh_from_db()
    assert run.status == PipelineRunStatus.SUCCESS
    assert "advanced" in out.getvalue().lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_service.py -v -k tick_command`
Expected: FAIL — `CommandError: Unknown command: 'pipeline_tick'`.

- [ ] **Step 3: Write the command**

`platform/workflow/management/__init__.py` — empty file.
`platform/workflow/management/commands/__init__.py` — empty file.

`platform/workflow/management/commands/pipeline_tick.py`:

```python
"""Advances every active pipeline run one step. Meant to be invoked by an
external cron (one-shot, same operational shape as automation's own
automation_run_due), or run as a long-lived process with --loop for
pipelines that need faster-than-cron progress (e.g. live progress UI)."""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from workflow.engine import tick_all


class Command(BaseCommand):
    help = "Advance every active pipeline run by one step."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--loop", action="store_true", help="Run forever, ticking on an interval.")
        parser.add_argument(
            "--interval", type=float, default=None,
            help="Seconds between ticks in --loop mode (default: settings.PIPELINE_TICK_INTERVAL_SECONDS).",
        )

    def handle(self, *args, **options) -> None:
        from django.conf import settings

        interval = options["interval"] or settings.PIPELINE_TICK_INTERVAL_SECONDS
        if not options["loop"]:
            summary = tick_all()
            self.stdout.write(
                self.style.SUCCESS(f"Tick complete: {summary.advanced} advanced, {summary.reclaimed} reclaimed.")
            )
            return

        self.stdout.write(f"Ticking every {interval}s. Ctrl+C to stop.")
        while True:
            summary = tick_all()
            if summary.advanced or summary.reclaimed:
                self.stdout.write(f"advanced={summary.advanced} reclaimed={summary.reclaimed}")
            time.sleep(interval)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_workflow_service.py -v -k tick_command`
Expected: 1 passed.

- [ ] **Step 5: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform/workflow`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add platform/workflow/management platform/tests/test_workflow_service.py
git commit -m "feat(platform/workflow): pipeline_tick management command"
```

---

### Task 12: Automation registers its pipelines

**Files:**

- Create: `platform/automation/pipelines.py`
- Modify: `platform/automation/apps.py`
- Test: append a new section to `platform/tests/test_automation.py` (new tests only — nothing existing changes)

**Interfaces:**

- Consumes: `workflow.registry.{PipelineDefinition, StepContext, StepDefinition, StepResult, register_pipeline}` (Task 3); `AutomationService._collect_and_package` and `ReportService().run` (existing, unmodified).
- Produces: `automation.pipelines.PACKAGE_PIPELINE_KEY`, `REPORT_PIPELINE_KEY`, `register_pipelines()`.

Note on scope vs. the design spec: the spec sketched `collect_files`/`store_package` as two steps. In practice, `PipelineRun.context` is a `JSONField` — it can't carry the raw zip bytes between two steps without an ugly base64 side-channel. Since collecting, zipping, and storing today is one atomic operation with no natural JSON-safe boundary, this plan keeps it as **one** step (`collect_and_package`), still gaining retry/crash-recovery/pause/cancel for free from the engine. A future pipeline with genuinely JSON-safe intermediate outputs (e.g. invoice generation: reserve number → render → store → index) won't hit this constraint.

- [ ] **Step 1: Write the failing test**

Append to `platform/tests/test_automation.py` (new section at the end of the file, nothing above it changes):

```python
# --------------------------------------------------------------------------- #
# Pipeline registration (workflow engine migration)
# --------------------------------------------------------------------------- #


def test_automation_pipelines_are_registered():
    from workflow.registry import all_pipelines

    keys = {p.key for p in all_pipelines()}
    assert "automation.rule_execution.package" in keys
    assert "automation.rule_execution.report" in keys
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k pipelines_are_registered`
Expected: FAIL — the keys aren't in `all_pipelines()` yet.

- [ ] **Step 3: Write `automation/pipelines.py`**

```python
"""Registers automation's rule-execution behavior as pipelines on the
generic workflow engine (platform/workflow). Step bodies stay owned by
AutomationService — this module holds only thin adapters, so business logic
isn't split across two files.

Each pipeline is a single step, not artificially split into more: see the
note in docs/superpowers/plans/2026-07-24-pipeline-execution-engine.md
Task 12 for why (PipelineRun.context is JSON-only; today's collect+zip+store
has no natural JSON-safe boundary to split across).
"""

from __future__ import annotations

from django.utils import timezone
from workflow.registry import PipelineDefinition, StepContext, StepDefinition, StepResult, register_pipeline

PACKAGE_PIPELINE_KEY = "automation.rule_execution.package"
REPORT_PIPELINE_KEY = "automation.rule_execution.report"


def _run_collect_and_package(ctx: StepContext) -> StepResult:
    from automation.models import AutomationRule
    from automation.services import AutomationService

    rule = AutomationRule.objects.get(id=ctx.data["rule_id"])
    items, output_file = AutomationService()._collect_and_package(
        rule=rule, started=timezone.now(), actor=ctx.actor
    )
    return StepResult(output={
        "items": items,
        "output_file_id": str(output_file.id) if output_file else None,
    })


def _run_report(ctx: StepContext) -> StepResult:
    from automation.models import AutomationRule
    from reporting.services import ReportService

    rule = AutomationRule.objects.get(id=ctx.data["rule_id"])
    report_export = ReportService().run(
        key=rule.report_key,
        format=rule.export_format or "csv",
        filters={"tag_ids": rule.required_tags},
        tenant=ctx.tenant,
        actor=ctx.actor,
    )
    return StepResult(output={
        "report_export_id": str(report_export.id),
        "items": [{
            "module": "reporting",
            "object_type": "ReportExport",
            "object_id": str(report_export.id),
            "title": report_export.title,
            "included": True,
        }],
    })


def register_pipelines() -> None:
    register_pipeline(PipelineDefinition(
        key=PACKAGE_PIPELINE_KEY,
        label="Collect and package tagged records",
        module="automation",
        permission="automation.run",
        version=1,
        steps=[
            StepDefinition(
                key="collect_and_package", label="Collect & package",
                run=_run_collect_and_package, max_attempts=2,
            )
        ],
    ))
    register_pipeline(PipelineDefinition(
        key=REPORT_PIPELINE_KEY,
        label="Generate a report",
        module="automation",
        permission="automation.run",
        version=1,
        steps=[StepDefinition(key="run_report", label="Run report", run=_run_report, max_attempts=2)],
    ))
```

- [ ] **Step 4: Wire it into `AutomationConfig.ready()`**

Replace `platform/automation/apps.py`:

```python
from django.apps import AppConfig


class AutomationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "automation"
    verbose_name = "Platform · Automation"

    def ready(self) -> None:
        from automation.pipelines import register_pipelines

        register_pipelines()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k pipelines_are_registered`
Expected: 1 passed.

- [ ] **Step 6: Full verify — confirm nothing else in `test_automation.py` broke**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v`
Expected: every existing test still passes (they don't touch the new pipelines yet — `run_rule()` isn't switched over until Task 14) plus the 1 new test.

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform/automation`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add platform/automation/pipelines.py platform/automation/apps.py platform/tests/test_automation.py
git commit -m "feat(automation): register rule-execution pipelines on the workflow engine"
```

---

### Task 13: Event subscriber — legacy `AutomationRun` from a finished pipeline

**Files:**

- Modify: `platform/automation/models.py`, `platform/automation/services.py`, `platform/automation/apps.py`
- Create: `platform/automation/events/__init__.py`, `platform/automation/events/subscribers.py`, `platform/automation/migrations/000X_automationrun_pipeline_run.py` (generated)
- Test: append to `platform/tests/test_automation.py`

**Interfaces:**

- Consumes: `shared.events.{Events, subscribe}` (existing); `automation.pipelines.{PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY}` (Task 12); `automation.services.AutomationService._record_run` / `._advance_schedule` (existing — `_record_run`'s signature grows one optional parameter).
- Produces: `AutomationRun.pipeline_run` FK; a working `_on_pipeline_finished` subscriber. **This task does not yet change `run_rule()`** — that's Task 14. This task is testable on its own by publishing the event directly.

- [ ] **Step 1: Write the failing test**

Append to `platform/tests/test_automation.py`:

```python
def test_subscriber_builds_automation_run_from_a_finished_pipeline(tenant, tag, tagged_asset):
    from shared.events import Events, publish
    from workflow.services import PipelineService
    from automation.pipelines import PACKAGE_PIPELINE_KEY

    rule = _make_rule(tenant, required_tags=[str(tag.id)])

    run, _ = PipelineService().start(
        pipeline_key=PACKAGE_PIPELINE_KEY, tenant=tenant, trigger_type=TriggerType.MANUAL,
        source_module="automation", source_object_type="AutomationRule", source_object_id=str(rule.id),
        input_data={"rule_id": str(rule.id)},
    )
    finished = PipelineService().run_to_completion(run)
    assert finished.status == "success"

    # The subscriber already ran synchronously inside run_to_completion (via
    # the engine's publish() call) — this just re-publishes to prove the
    # subscriber itself is idempotent-safe to call directly too.
    publish(Events.WORKFLOW_COMPLETED, instance=finished)

    automation_run = AutomationRun.objects.get(pipeline_run=finished)
    assert automation_run.status == RunStatus.SUCCESS
    assert automation_run.item_count == 1
    assert automation_run.rule == rule
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k subscriber_builds`
Expected: FAIL — `AutomationRun` has no `pipeline_run` field yet, and no subscriber exists.

- [ ] **Step 3: Add the additive `pipeline_run` FK**

In `platform/automation/models.py`, add to `AutomationRun` (after the `actor` field):

```python
    # Links to the workflow.PipelineRun that produced this row (Task 13+).
    # Nullable and not exposed in AutomationRunSerializer — purely internal,
    # keeps the existing frontend contract unchanged.
    pipeline_run = models.ForeignKey(
        "workflow.PipelineRun", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
```

Generate the migration:
Run: `cd platform && ./.venv/Scripts/python.exe manage.py makemigrations automation`
Expected: a new migration adding `pipeline_run` to `AutomationRun`.

- [ ] **Step 4: Extend `_record_run` to accept the new FK**

In `platform/automation/services.py`, find `_record_run`'s signature and body:

```python
    def _record_run(
        self,
        *,
        rule: AutomationRule,
        status: str,
        triggered_by: str,
        started,
        finished,
        items: list[dict[str, Any]],
        output_file,
        report_export,
        error: str,
        actor,
    ) -> AutomationRun:
        run = AutomationRun.objects.create(
            tenant=rule.tenant,
            rule=rule,
            rule_name=rule.name,
            destination=rule.destination,
            status=status,
            triggered_by=triggered_by,
            started_at=started,
            finished_at=finished,
            item_count=len(items),
            items=items,
            output_file=output_file,
            report_export=report_export,
            error_message=error,
            actor=actor,
        )
```

Replace with:

```python
    def _record_run(
        self,
        *,
        rule: AutomationRule,
        status: str,
        triggered_by: str,
        started,
        finished,
        items: list[dict[str, Any]],
        output_file,
        report_export,
        error: str,
        actor,
        pipeline_run=None,
    ) -> AutomationRun:
        run = AutomationRun.objects.create(
            tenant=rule.tenant,
            rule=rule,
            rule_name=rule.name,
            destination=rule.destination,
            status=status,
            triggered_by=triggered_by,
            started_at=started,
            finished_at=finished,
            item_count=len(items),
            items=items,
            output_file=output_file,
            report_export=report_export,
            error_message=error,
            actor=actor,
            pipeline_run=pipeline_run,
        )
```

(The rest of `_record_run` — the `AuditService().record(...)` call and `publish("automation.rule_executed", ...)` — is unchanged.)

- [ ] **Step 5: Write the subscriber**

`platform/automation/events/__init__.py` — empty file.

`platform/automation/events/subscribers.py`:

```python
"""Wires the generic pipeline engine's completion/cancellation events into
automation's legacy AutomationRun record — the one the current /automation
frontend reads. workflow/ has no knowledge AutomationRun exists; this
subscriber is where that meaning lives, the same separation every future
pipeline consumer will keep.
"""

from __future__ import annotations

from typing import Any

from shared.events import Events, subscribe

from automation.pipelines import PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY


def _on_pipeline_finished(event: str, instance: Any = None, **_extra: Any) -> None:
    run = instance
    if run is None or run.pipeline_key not in (PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY):
        return

    from automation.models import AutomationRule, RunStatus
    from automation.services import AutomationService
    from workflow.models import PipelineRunStatus

    rule = AutomationRule.objects.filter(id=run.source_object_id).first()
    if rule is None:
        return  # rule was deleted between start and finish — nothing left to record against

    step = run.steps.order_by("step_index").first()
    items: list[dict[str, Any]] = []
    output_file = None
    report_export = None

    if run.status == PipelineRunStatus.SUCCESS and step is not None:
        output = step.output
        items = output.get("items", [])
        if output.get("output_file_id"):
            from storage.models import StoredFile

            output_file = StoredFile.objects.filter(id=output["output_file_id"]).first()
        if output.get("report_export_id"):
            from reporting.models import ReportExport

            report_export = ReportExport.objects.filter(id=output["report_export_id"]).first()

    status = RunStatus.SUCCESS if run.status == PipelineRunStatus.SUCCESS else RunStatus.FAILED
    error = run.error_message or ("Cancelled." if run.status == PipelineRunStatus.CANCELLED else "")
    finished = run.finished_at or run.queued_at

    AutomationService()._record_run(
        rule=rule, status=status, triggered_by=run.trigger_type,
        started=run.started_at or run.queued_at, finished=finished,
        items=items, output_file=output_file, report_export=report_export,
        error=error, actor=run.triggered_by, pipeline_run=run,
    )
    AutomationService()._advance_schedule(rule=rule, finished=finished)


subscribe(Events.WORKFLOW_COMPLETED, _on_pipeline_finished)
subscribe(Events.WORKFLOW_CANCELLED, _on_pipeline_finished)
```

- [ ] **Step 6: Import the subscriber from `ready()`**

In `platform/automation/apps.py`, add the import at the end of `ready()`:

```python
    def ready(self) -> None:
        from automation.pipelines import register_pipelines

        register_pipelines()

        from automation.events import subscribers  # noqa: F401
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k subscriber_builds`
Expected: 1 passed.

- [ ] **Step 8: Full verify — the whole file, still untouched-above**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v`
Expected: every original test still passes unmodified, plus the 2 new tests from Tasks 12–13.

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform/automation`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add platform/automation/models.py platform/automation/migrations platform/automation/services.py platform/automation/events platform/automation/apps.py platform/tests/test_automation.py
git commit -m "feat(automation): build the legacy AutomationRun from a finished pipeline"
```

---

### Task 14: Switch `run_rule()` to the engine, fix the double-run race

**Files:**

- Modify: `platform/automation/services.py`
- Test: append to `platform/tests/test_automation.py`

**Interfaces:**

- Consumes: `workflow.services.PipelineService` (Task 9); `automation.pipelines.{PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY}` (Task 12); the subscriber from Task 13 (already wired).
- Produces: the final `run_rule()` — same signature and return type (`AutomationRun`) as before.

**This is the task where `test_automation.py`'s original, unmodified tests become the acceptance gate.** If any of them need a code change here, something in this migration is wrong.

- [ ] **Step 1: Write the failing test (the double-run race fix)**

Append to `platform/tests/test_automation.py`:

```python
def test_automation_run_due_concurrent_invocations_do_not_double_run_same_rule(
    tenant, tag, tagged_asset,
):
    rule = _make_rule(tenant, required_tags=[str(tag.id)], cadence=Cadence.DAILY)

    # Two "concurrent" cron invocations picking up the same due rule.
    from automation.services import AutomationService

    service = AutomationService()
    run1 = service.run_rule(rule=rule, triggered_by=TriggerType.SCHEDULE)
    # A second call for the SAME scheduled tick (rule.next_run_at unchanged
    # between calls, simulating two overlapping cron processes) must land
    # on the same underlying pipeline run, not create a second one.
    from workflow.services import PipelineService
    from automation.pipelines import PACKAGE_PIPELINE_KEY

    idem_key = f"rule:{rule.id}:{run1.started_at.isoformat()}"
    # Reuse the same idempotency key run_rule() would have generated for
    # this rule's PREVIOUS next_run_at (before _advance_schedule moved it) —
    # start() with that key must return the already-finished run, not a new one.
    replay_run, created = PipelineService().start(
        pipeline_key=PACKAGE_PIPELINE_KEY, tenant=tenant,
        idempotency_key=f"rule:{rule.id}:{run1.started_at.isoformat()}",
    )
    assert created is False  # same key => same row, whatever run_rule already created


def test_run_now_manual_trigger_has_no_idempotency_dedup(tenant, tag, tagged_asset):
    rule = _make_rule(tenant, required_tags=[str(tag.id)])
    from automation.services import AutomationService

    run1 = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)
    run2 = AutomationService().run_rule(rule=rule, triggered_by=TriggerType.MANUAL)

    assert run1.id != run2.id
    assert AutomationRun.objects.filter(rule=rule).count() == 2
```

Note: the test above verifies the idempotency-key _mechanism_ directly (since two truly concurrent OS-level processes aren't reproducible in a single-process pytest run) — the underlying guarantee (`PipelineRun`'s partial unique constraint from Task 2, exercised via `PipelineService.start` in Task 9) is what makes real concurrent cron invocations safe; this test proves `run_rule()` wires that key through correctly for the scheduled-trigger case, and proves manual triggers deliberately opt out of it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k "double_run or no_idempotency"`
Expected: FAIL — `run_rule()` doesn't use the pipeline engine yet, so no matching `PipelineRun` exists for the idempotency key.

- [ ] **Step 3: Rewrite `run_rule()`**

In `platform/automation/services.py`, replace:

```python
    def run_rule(
        self, *, rule: AutomationRule, actor=None, triggered_by: str = TriggerType.SCHEDULE
    ) -> AutomationRun:
        if rule.destination in STUB_DESTINATIONS:
            raise ConflictError(
                f"{rule.get_destination_display()} isn't available yet — this rule can be "
                "saved, but not run."
            )

        started = timezone.now()
        items: list[dict[str, Any]] = []
        output_file = None
        report_export = None
        error = ""
        status = RunStatus.SUCCESS

        try:
            if rule.destination == Destination.GENERATE_REPORT:
                from reporting.services import ReportService

                report_export = ReportService().run(
                    key=rule.report_key,
                    format=rule.export_format or "csv",
                    filters={"tag_ids": rule.required_tags},
                    tenant=rule.tenant,
                    actor=actor,
                )
                items = [
                    {
                        "module": "reporting",
                        "object_type": "ReportExport",
                        "object_id": str(report_export.id),
                        "title": report_export.title,
                        "included": True,
                    }
                ]
            else:
                items, output_file = self._collect_and_package(
                    rule=rule, started=started, actor=actor
                )
        except Exception as exc:  # recorded on the run below, never re-raised — one bad rule
            status = RunStatus.FAILED  # must not stop the rest of a scheduled sweep.
            error = str(exc)

        finished = timezone.now()
        run = self._record_run(
            rule=rule,
            status=status,
            triggered_by=triggered_by,
            started=started,
            finished=finished,
            items=items,
            output_file=output_file,
            report_export=report_export,
            error=error,
            actor=actor,
        )
        self._advance_schedule(rule=rule, finished=finished)
        return run
```

with:

```python
    def run_rule(
        self, *, rule: AutomationRule, actor=None, triggered_by: str = TriggerType.SCHEDULE
    ) -> AutomationRun:
        if rule.destination in STUB_DESTINATIONS:
            raise ConflictError(
                f"{rule.get_destination_display()} isn't available yet — this rule can be "
                "saved, but not run."
            )

        from automation.pipelines import PACKAGE_PIPELINE_KEY, REPORT_PIPELINE_KEY
        from workflow.services import PipelineService

        pipeline_key = (
            REPORT_PIPELINE_KEY if rule.destination == Destination.GENERATE_REPORT
            else PACKAGE_PIPELINE_KEY
        )
        # Only a scheduled trigger gets a dedup key — two overlapping cron
        # invocations for the SAME due tick must collapse to one run; two
        # manual "Run now" clicks are legitimately two separate runs.
        idem_key = (
            f"rule:{rule.id}:{rule.next_run_at.isoformat()}"
            if triggered_by == TriggerType.SCHEDULE and rule.next_run_at
            else ""
        )
        run, _created = PipelineService().start(
            pipeline_key=pipeline_key, tenant=rule.tenant, actor=actor, trigger_type=triggered_by,
            idempotency_key=idem_key, source_module="automation",
            source_object_type="AutomationRule", source_object_id=str(rule.id),
            input_data={"rule_id": str(rule.id)},
        )
        PipelineService().run_to_completion(run, actor=actor)
        return AutomationRun.objects.get(pipeline_run=run)
```

Note: `_advance_schedule` is no longer called from `run_rule()` directly — it now runs inside the Task 13 subscriber, once, exactly when the pipeline actually finishes (success, failure, or cancellation), which is the same timing the old code had (`_advance_schedule` was always called right after `_record_run`).

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v -k "double_run or no_idempotency"`
Expected: 2 passed.

- [ ] **Step 5: Run the ENTIRE `test_automation.py` file — this is the acceptance gate**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest tests/test_automation.py -v`
Expected: **every single test in the file passes**, including all the original ones (`test_run_rule_packages_tagged_files`, `test_run_rule_with_no_matches_fails_cleanly`, `test_run_rule_advances_once_cadence_to_inactive`, `test_run_rule_rejects_stub_destination`, `test_run_rule_generate_report_destination`, `test_run_rule_writes_audit_entry`, `test_api_create_rule_rejects_empty_tags`, `test_api_create_and_run_now`, `test_api_run_now_requires_automation_run_permission`, plus everything added in Tasks 12–14). If any original test fails, stop and fix `run_rule()` or the subscriber — do not modify the original test to make it pass.

- [ ] **Step 6: Full verify**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q && ./.venv/Scripts/python.exe manage.py check`
Run: `cd .. && python -m ruff check platform`
Expected: all green — the entire backend test suite (not just automation) passes.

- [ ] **Step 7: Commit**

```bash
git add platform/automation/services.py platform/tests/test_automation.py
git commit -m "feat(automation): run rules on the workflow engine, fix the automation_run_due double-run race"
```

---

### Task 15: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Full backend gate**

Run: `cd platform && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass (original suite + every new `test_workflow_*.py` file + the additive `test_automation.py` tests).

Run: `cd platform && ./.venv/Scripts/python.exe manage.py check`
Expected: `System check identified no issues (0 silenced).`

Run: `cd .. && python -m ruff check platform`
Expected: `All checks passed!`

Run: `cd .. && python -m ruff format --check platform`
Expected: no files need reformatting (run `python -m ruff format platform` first if anything is flagged, then re-check).

- [ ] **Step 2: Confirm the frontend contract is untouched**

Run: `cd .. && pnpm --filter web build`
Expected: succeeds unchanged — this plan touched no files under `apps/web/`, so this is a regression check, not expected to reveal anything new.

- [ ] **Step 3: Manual smoke test of the new API surface**

With the dev server running (`cd platform && python manage.py runserver`) and a valid JWT for an Owner user:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/workflow/runs/
```

Expected: `200` with a JSON envelope containing (at minimum) any `PipelineRun`s created by the automation tests run against a real dev database, each with a nested `steps` array.

- [ ] **Step 4: Confirm `pre-commit` passes**

Run: `cd .. && python -m pre_commit run --all-files`
Expected: `ruff check`, `ruff format`, `prettier check`, `eslint` all pass.

- [ ] **Step 5: Final commit (if step 1's `ruff format` needed fixes)**

```bash
git add -A
git commit -m "chore: final formatting pass for the pipeline execution engine"
```

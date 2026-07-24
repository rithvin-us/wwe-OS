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

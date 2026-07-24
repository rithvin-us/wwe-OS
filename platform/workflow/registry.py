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
    # None defers to settings.PIPELINE_STEP_STALE_TIMEOUT_SECONDS (the
    # configurable default) — only set this to override that default for
    # one specific step.
    timeout_seconds: int | None = None


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

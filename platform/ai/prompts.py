"""Prompt library — code-defined, versioned prompt templates.

Prompts live in code (not the database) for the same reason permissions do:
they are reviewed, diffed, and shipped with the code that depends on them.
Modules register their own prompts from `AppConfig.ready()` using
`register()`, then request them by key through `AIService.generate(
prompt_key=...)` — never by embedding prompt strings inline. Analytics come
free: every AI call records its prompt key as `AIUsage.use_case`.

Variables use `str.format` placeholders. Rendering validates that exactly
the declared variables are supplied — a missing or unknown variable is a
caller bug surfaced immediately, not a silently broken prompt.
"""

from __future__ import annotations

import string
from dataclasses import dataclass, field

from shared.exceptions import ConflictError, NotFoundError, ValidationError


@dataclass(frozen=True)
class PromptDef:
    key: str
    version: int
    category: str
    description: str
    system: str
    user: str
    variables: tuple[str, ...] = field(default_factory=tuple)
    model_hint: str = ""  # preferred model; AI_DEFAULT_MODEL when empty


_REGISTRY: dict[str, PromptDef] = {}


def register(prompt: PromptDef) -> None:
    existing = _REGISTRY.get(prompt.key)
    if existing is not None and existing != prompt:
        raise ConflictError(f"Prompt key '{prompt.key}' is already registered.")
    _template_variables(prompt)  # fail fast on malformed templates
    _REGISTRY[prompt.key] = prompt


def get(key: str) -> PromptDef:
    prompt = _REGISTRY.get(key)
    if prompt is None:
        raise NotFoundError(f"Prompt '{key}' is not registered.")
    return prompt


def all_prompts() -> list[PromptDef]:
    return sorted(_REGISTRY.values(), key=lambda p: p.key)


def _template_variables(prompt: PromptDef) -> set[str]:
    """Placeholders actually used in the templates; must equal the declared
    variables so documentation and reality cannot drift."""
    formatter = string.Formatter()
    found = {
        name
        for template in (prompt.system, prompt.user)
        for _, name, _, _ in formatter.parse(template)
        if name
    }
    declared = set(prompt.variables)
    if found != declared:
        raise ValidationError(
            detail={
                "variables": [
                    f"Prompt '{prompt.key}': declared {sorted(declared)} but templates use "
                    f"{sorted(found)}."
                ]
            }
        )
    return found


def render(key: str, variables: dict[str, str] | None = None) -> tuple[str, str]:
    """Return (system, user) with variables substituted and validated."""
    prompt = get(key)
    supplied = variables or {}
    declared = set(prompt.variables)
    missing = declared - supplied.keys()
    unknown = supplied.keys() - declared
    if missing or unknown:
        problems = []
        if missing:
            problems.append(f"missing: {sorted(missing)}")
        if unknown:
            problems.append(f"unknown: {sorted(unknown)}")
        raise ValidationError(detail={"variables": [f"Prompt '{key}' — {'; '.join(problems)}."]})
    return prompt.system.format(**supplied), prompt.user.format(**supplied)


# --------------------------------------------------------------------------- #
# Platform-generic prompts (business modules register their own)
# --------------------------------------------------------------------------- #

register(
    PromptDef(
        key="generic-summary",
        version=1,
        category="general",
        description="Summarize arbitrary text in a requested number of sentences.",
        system=(
            "You are a precise business writing assistant. Summarize the user's text "
            "faithfully. Never invent facts that are not in the text."
        ),
        user="Summarize the following in at most {sentences} sentences:\n\n{text}",
        variables=("sentences", "text"),
    )
)

register(
    PromptDef(
        key="dashboard-business-summary",
        version=1,
        category="general",
        description="A short operator-facing summary of today's activity for the dashboard.",
        system=(
            "You are a precise business operations assistant for a single-operator company. "
            "Write a short, plain-language summary the owner can read in five seconds. Never "
            "invent numbers or events not present in the figures given — if activity is low, "
            "say things are quiet rather than inventing detail."
        ),
        user=(
            "Today's figures:\n{stats}\n\n"
            "Write 2-3 sentences summarizing how the company is doing today, in plain "
            "business language — no jargon, no headers, no bullet points."
        ),
        variables=("stats",),
    )
)

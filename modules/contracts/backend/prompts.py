"""Contract module AI prompts, registered into the platform prompt library."""

from __future__ import annotations

from ai.prompts import PromptDef, register

CONTRACT_SUMMARY = PromptDef(
    key="contracts-summary",
    version=1,
    category="contracts",
    description="Summarize a contract from its metadata and (optional) text.",
    system=(
        "You are a precise contracts assistant for a business operator. Summarize the "
        "agreement plainly: what it is, who the parties are, key obligations, money, and "
        "dates. Never invent terms not present in the content. Flag anything that reads "
        "as a notable obligation or deadline."
    ),
    user="Summarize this contract titled '{title}'.\n\nContent:\n{content}",
    variables=("title", "content"),
)


def register_prompts() -> None:
    register(CONTRACT_SUMMARY)

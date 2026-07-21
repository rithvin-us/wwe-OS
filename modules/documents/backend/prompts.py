"""Document module AI prompts.

Registered into the platform prompt library at app-ready. The module requests
this prompt by key through `AIService.generate(prompt_key=...)` and never
embeds prompt strings inline — the platform owns prompt versioning, rendering,
and analytics.
"""

from __future__ import annotations

from ai.prompts import PromptDef, register

DOCUMENT_SUMMARY = PromptDef(
    key="documents-summary",
    version=1,
    category="documents",
    description="Summarize a business document from its title and text content.",
    system=(
        "You are a precise business document assistant. Produce a concise, factual "
        "summary a busy operator can skim. Never invent facts absent from the content. "
        "If the content is too sparse to summarize, say so plainly."
    ),
    user=(
        "Summarize the business document titled '{title}'. Give 2–4 sentences covering "
        "what it is and the key facts.\n\nContent:\n{content}"
    ),
    variables=("title", "content"),
)


def register_prompts() -> None:
    register(DOCUMENT_SUMMARY)

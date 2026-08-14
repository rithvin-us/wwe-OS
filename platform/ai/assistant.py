"""WWE OS Assistant — a question-answerer grounded in the company's own data.

Not a general chatbot. Every answer is built from records the asking user is
allowed to see: the question is run through the platform search engine
(permission-aware, tenant-scoped), the matching records become the *only*
context handed to the AI gateway, and the system prompt forbids using anything
else or inventing figures. The real records come back as sources so the answer
is always traceable. If nothing matches, it says so rather than guessing.
"""

from __future__ import annotations

from typing import Any

from search.services import SearchService
from shared.services import BaseService

from ai.services import AIService

MAX_SOURCES = 6
QUESTION_LIMIT = 500

SYSTEM_PROMPT = (
    "You are the assistant for WWE OS, a company operations platform. "
    "Answer the user's question using ONLY the CONTEXT records provided below. "
    "The context is the company's real data; treat it as the single source of truth. "
    "If the answer is not contained in the context, say you don't have that information "
    "in the records — do not guess, and never invent numbers, dates, names or amounts. "
    "Refer to records by their title. Be concise and factual."
)

NO_DATA_ANSWER = (
    "I couldn't find anything about that in your WWE OS records. "
    "Try a customer, invoice number, site, employee, document or contract name."
)


class AssistantService(BaseService):
    def answer(self, *, user, question: str) -> dict[str, Any]:
        question = (question or "").strip()[:QUESTION_LIMIT]
        if not question:
            return {
                "answer": "Ask me something about your WWE OS data.",
                "sources": [],
                "grounded": False,
            }

        hits = SearchService().search(
            user=user, query=question, page_size=MAX_SOURCES
        )["results"]

        sources = [
            {
                "title": hit["title"],
                "url": hit["url"],
                "index": hit["index"],
                "excerpt": hit["excerpt"],
            }
            for hit in hits
        ]

        # Grounded-only: no matching records means we don't answer from thin air.
        if not sources:
            return {"answer": NO_DATA_ANSWER, "sources": [], "grounded": False}

        result = AIService().generate(
            module="assistant",
            use_case="assistant",
            system=SYSTEM_PROMPT,
            user=self._build_prompt(question, hits),
            tenant=getattr(user, "tenant", None),
            requested_by=user,
            max_tokens=600,
            temperature=0.2,
        )
        return {"answer": result.text, "sources": sources, "grounded": True}

    @staticmethod
    def _build_prompt(question: str, hits: list[dict]) -> str:
        lines = [f"Question: {question}", "", "CONTEXT (the only data you may use):"]
        for index, hit in enumerate(hits, start=1):
            kind = hit["index"].rstrip("s").capitalize()
            excerpt = hit.get("excerpt") or ""
            lines.append(f"{index}. [{kind}] {hit['title']} — {excerpt}".rstrip(" —"))
        return "\n".join(lines)

"""
Policy Chat Service

Answers HR questions from the company policies markdown using lightweight
keyword retrieval — no LLM dependency.

Migrated verbatim from the legacy app apart from the corpus path. Kept
keyword-based rather than re-pointed at platform/ai on purpose: it is
deterministic, costs nothing, needs no network, and cannot hallucinate a
policy the company does not have. platform/ai is the right tool when an
answer must be composed; quoting a policy section is retrieval, not
generation. The document is split into sections at
`## ` headings; the question is scored against each section by term overlap
(heading hits weighted higher) and the best section(s) become the answer.
"""

import logging
import re
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# The policy corpus ships with the module — it is content, not code, and
# cannot be regenerated (docs/specs/hr-migration.md § 8).
POLICIES_PATH = Path(__file__).resolve().parent.parent / "data" / "company_policies.md"

# Common words excluded from scoring so "what is the policy for..." doesn't
# match every section equally.
_STOP_WORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "do",
    "does",
    "did",
    "can",
    "could",
    "will",
    "would",
    "should",
    "i",
    "we",
    "you",
    "my",
    "our",
    "your",
    "me",
    "us",
    "it",
    "its",
    "of",
    "for",
    "to",
    "in",
    "on",
    "at",
    "by",
    "with",
    "and",
    "or",
    "not",
    "no",
    "what",
    "when",
    "where",
    "who",
    "how",
    "why",
    "which",
    "about",
    "tell",
    "please",
    "policy",
    "policies",
    "company",
    "many",
    "much",
    "get",
    "have",
    "has",
    "there",
}

# Synonyms folded into canonical tokens so everyday phrasing hits the right
# section ("pto" → leave, "wfh" → work, "salary slip" → payslip …).
_SYNONYMS = {
    "vacation": "leave",
    "pto": "leave",
    "holiday": "leave",
    "holidays": "leave",
    "sick": "sick",
    "timeoff": "leave",
    "off": "leave",
    "pay": "salary",
    "paid": "salary",
    "wages": "salary",
    "payslip": "payslips",
    "reimbursement": "reimbursed",
    "reimburse": "reimbursed",
    "claim": "claimed",
    "claims": "claimed",
    "expense": "expenses",
    "laptop": "assets",
    "laptops": "assets",
    "equipment": "assets",
    "computer": "assets",
    "phone": "assets",
    "resign": "resignation",
    "resigning": "resignation",
    "quit": "resignation",
    "notice": "notice",
    "checkin": "check",
    "check-in": "check",
    "attendance": "attendance",
    "selfie": "check",
    "face": "check",
    "shift": "shifts",
    "hours": "hours",
    "overtime": "overtime",
    "ot": "overtime",
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", text.lower())
    tokens = []
    for w in words:
        w = _SYNONYMS.get(w, w)
        if w not in _STOP_WORDS and len(w) > 1:
            tokens.append(w)
    return tokens


@lru_cache(maxsize=1)
def _load_sections() -> list[tuple[str, str]]:
    """Parse the policies file into (heading, body) pairs, cached for the process."""
    try:
        text = POLICIES_PATH.read_text(encoding="utf-8")
    except OSError:
        logger.exception("Company policies file missing at %s", POLICIES_PATH)
        return []

    sections: list[tuple[str, str]] = []
    current_heading = "General"
    current_body: list[str] = []
    for line in text.splitlines():
        if line.startswith("## "):
            if current_body:
                sections.append((current_heading, "\n".join(current_body).strip()))
            current_heading = line[3:].strip()
            current_body = []
        elif not line.startswith("# "):
            current_body.append(line)
    if current_body:
        sections.append((current_heading, "\n".join(current_body).strip()))
    return [(h, b) for h, b in sections if b]


def answer_query(query: str) -> tuple[str, list[str]]:
    """
    Return (answer, source_headings) for a policy question.

    Scores each section by query-token frequency (heading matches ×3) and
    answers with the top section, adding the runner-up when scores are close.
    """
    sections = _load_sections()
    if not sections:
        return (
            "The company policy document is not available right now — please contact HR directly.",
            [],
        )

    q_tokens = _tokenize(query)
    if not q_tokens:
        return (
            "I can answer questions about company policies — working hours, leave, "
            "payroll, expenses, IT assets, conduct, and resignation. What would you like to know?",
            [],
        )

    scored = []
    for heading, body in sections:
        head_tokens = set(_tokenize(heading))
        body_tokens = _tokenize(body)
        body_counts: dict[str, int] = {}
        for t in body_tokens:
            body_counts[t] = body_counts.get(t, 0) + 1

        score = 0.0
        for t in q_tokens:
            if t in head_tokens:
                score += 3.0
            score += min(body_counts.get(t, 0), 3)  # cap per-term so one word can't dominate
        scored.append((score, heading, body))

    scored.sort(key=lambda s: s[0], reverse=True)
    best_score, best_heading, best_body = scored[0]

    if best_score <= 0:
        return (
            "I couldn't find that in the company policies. Try asking about working hours, "
            "leave, payroll, expense claims, IT assets, code of conduct, or resignation — "
            "or contact HR for anything else.",
            [],
        )

    answer = f"**{best_heading}**\n\n{best_body}"
    sources = [best_heading]

    # Append the runner-up section when it is nearly as relevant.
    if len(scored) > 1 and scored[1][0] >= best_score * 0.6 and scored[1][0] > 1:
        _, second_heading, second_body = scored[1]
        answer += f"\n\n**{second_heading}**\n\n{second_body}"
        sources.append(second_heading)

    return answer, sources

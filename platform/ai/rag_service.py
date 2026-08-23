"""RAG (Retrieval-Augmented Generation) Service.

Provides text extraction for documents stored in Cloudflare R2 / S3,
indexes text into platform search, and retrieves top matching document context
for Gemini AI prompt synthesis.
"""

from __future__ import annotations

import io
import re
from typing import Any

from shared import context
from shared.services import BaseService


def extract_text_from_file(data: bytes, content_type: str, filename: str) -> str:
    """Extract plain text from PDF, TXT, CSV, JSON, or HTML file bytes."""
    if not data:
        return ""

    filename_lower = filename.lower()
    if content_type == "application/pdf" or filename_lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            extracted = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    extracted.append(txt)
            return "\n".join(extracted).strip()
        except Exception:
            return ""

    if content_type in (
        "text/plain",
        "text/csv",
        "text/html",
        "application/json",
        "text/markdown",
    ) or filename_lower.endswith((".txt", ".csv", ".json", ".md", ".html")):
        try:
            return data.decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    return ""


class RAGService(BaseService):
    """Orchestrates document search & context retrieval for LLM prompts."""

    def search_rag_context(
        self,
        *,
        query: str,
        tenant=None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Find the top_k matching document context snippets for a RAG query."""
        from search.models import SearchDocument

        tenant = tenant or context.current_tenant()
        if not query.strip():
            return []

        # Tokenize query keywords
        keywords = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
        if not keywords:
            return []

        qs = SearchDocument.objects.all()
        if tenant is not None:
            qs = qs.filter(tenant_id=tenant.id)

        # Basic keyword relevance ranking across title & body
        results = []
        for doc in qs[:100]:
            title_lower = doc.title.lower()
            body_lower = doc.body.lower()
            score = sum(3 for k in keywords if k in title_lower) + sum(
                1 for k in keywords if k in body_lower
            )

            if score > 0:
                # Build an excerpt window around the first matching keyword
                snippet = doc.body[:250]
                for k in keywords:
                    idx = body_lower.find(k)
                    if idx != -1:
                        start = max(0, idx - 40)
                        end = min(len(doc.body), idx + 200)
                        snippet = ("..." if start > 0 else "") + doc.body[start:end] + "..."
                        break

                results.append(
                    {
                        "doc_id": doc.doc_id,
                        "title": doc.title,
                        "path": doc.url or f"/dms/{doc.doc_id}",
                        "category": doc.index.capitalize(),
                        "score": score,
                        "snippet": snippet or doc.title,
                        "content": doc.body[:1500],  # Max context window snippet
                    }
                )

        # Sort descending by relevance score
        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:top_k]

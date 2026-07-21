"""Document module event names — published on the shared platform event bus.

Module-local vocabulary; platform capabilities (audit, search) subscribe the
same way any subscriber does. Never imported by another business module.
"""

from __future__ import annotations

DOCUMENT_CREATED = "documents.created"
DOCUMENT_UPDATED = "documents.updated"
DOCUMENT_SUBMITTED = "documents.submitted"
DOCUMENT_APPROVED = "documents.approved"
DOCUMENT_REJECTED = "documents.rejected"
DOCUMENT_ARCHIVED = "documents.archived"
DOCUMENT_SUMMARIZED = "documents.summarized"

ALL_EVENTS = (
    DOCUMENT_CREATED,
    DOCUMENT_UPDATED,
    DOCUMENT_SUBMITTED,
    DOCUMENT_APPROVED,
    DOCUMENT_REJECTED,
    DOCUMENT_ARCHIVED,
    DOCUMENT_SUMMARIZED,
)

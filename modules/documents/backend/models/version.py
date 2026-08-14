"""Document versioning — an append-only history of a document's files.

Uploading a new file never overwrites the old one: each upload is stored as its
own `StoredFile` (its own bytes, its own checksum) and recorded here as a new
`DocumentVersion`. `Document.file` always points at whichever version is
current; restoring an older version appends a *new* current version pointing at
the old bytes, so history is never rewritten and "which file is live" always
has an answer.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class DocumentVersion(TenantOwnedModel):
    document = models.ForeignKey(
        "documents.Document", on_delete=models.CASCADE, related_name="versions"
    )
    version = models.PositiveIntegerField()
    file = models.ForeignKey(
        "storage.StoredFile", on_delete=models.PROTECT, related_name="document_versions"
    )
    is_current = models.BooleanField(default=True, db_index=True)
    note = models.CharField(max_length=300, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_versions",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "documents_document_version"
        ordering = ("-version",)
        constraints = [
            models.UniqueConstraint(
                fields=["document", "version"], name="uniq_document_version_number"
            ),
        ]
        indexes = [models.Index(fields=["document", "is_current"])]

    def __str__(self) -> str:
        return f"{self.document_id} v{self.version}"

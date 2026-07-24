"""Source identity — the trusted "who sent this" fact for every incoming
document, channel-agnostic. (tenant, channel, external_id) is the durable
identity fact and is never rewritten after creation; display_name and
last_seen_at are presentation and refresh on every resolution. See
docs/superpowers/specs/2026-07-24-identity-service-design.md §2c.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class IdentityChannel(models.TextChoices):
    TELEGRAM = "telegram", "Telegram"
    WHATSAPP = "whatsapp", "WhatsApp"
    EMAIL = "email", "Email"
    WEBHOOK = "webhook", "Webhook"
    MANUAL = "manual", "Manual upload"


class SourceIdentity(TenantOwnedModel):
    channel = models.CharField(max_length=10, choices=IdentityChannel.choices)
    external_id = models.CharField(max_length=200)
    display_name = models.CharField(max_length=200, blank=True, default="")
    # Opaque mapping target — same idiom as workflow/tagging/periods, so
    # this app never imports a business module (architecture rule 1/2).
    mapped_module = models.CharField(max_length=50, blank=True, default="")
    mapped_object_type = models.CharField(max_length=100, blank=True, default="")
    mapped_object_id = models.CharField(max_length=64, blank=True, default="")
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "identity_source_identity"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "channel", "external_id"], name="uniq_identity_per_channel"
            )
        ]
        indexes = [models.Index(fields=["tenant", "channel", "external_id"])]

    def __str__(self) -> str:
        return f"{self.channel}:{self.external_id}"

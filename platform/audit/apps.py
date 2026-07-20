from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "audit"
    verbose_name = "Platform · Audit"

    def ready(self) -> None:
        # Subscribe the audit recorder to every audited platform event.
        from shared.events import subscribe

        from audit.services import AUDITED_EVENTS, _on_event

        for event in AUDITED_EVENTS:
            subscribe(event, _on_event)

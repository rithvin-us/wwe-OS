from django.apps import AppConfig


class AlertsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "alerts"
    verbose_name = "Platform · Alerts"

    def ready(self) -> None:
        from alerts import subscribers  # noqa: F401  (registers event subscribers)

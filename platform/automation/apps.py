from django.apps import AppConfig


class AutomationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "automation"
    verbose_name = "Platform · Automation"

    def ready(self) -> None:
        from automation.pipelines import register_pipelines

        register_pipelines()

        from automation.events import subscribers  # noqa: F401

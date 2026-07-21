from django.apps import AppConfig


class WorkflowConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "workflow"
    verbose_name = "Platform · Workflow"

    def ready(self) -> None:
        from workflow import subscribers  # noqa: F401

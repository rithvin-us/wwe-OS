from django.apps import AppConfig


class StorageConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "storage"
    verbose_name = "Platform · Storage"

    def ready(self) -> None:
        from storage import subscribers  # noqa: F401

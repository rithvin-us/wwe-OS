from django.apps import AppConfig


class AuditorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "auditor"
    verbose_name = "Platform · Auditor Package Generator"

    def ready(self) -> None:
        from periods.registry import DocumentTypeDef, register_document_type

        register_document_type(
            DocumentTypeDef(
                key="auditor_package",
                label="Auditor Package",
                folder_segment="Auditor",
                is_library=False,
                module="auditor",
            )
        )

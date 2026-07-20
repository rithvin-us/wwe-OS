from django.apps import AppConfig


class PlatformAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # Directory/import name is `auth`; label is namespaced to avoid clashing
    # with django.contrib.auth's app label.
    name = "auth"
    label = "platform_auth"
    verbose_name = "Platform · Authentication"

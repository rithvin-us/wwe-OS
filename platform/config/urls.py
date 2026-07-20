"""Root URL configuration. All application endpoints live under /api/v1/."""

from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from config import health

api_v1 = [
    path("auth/", include("auth.urls")),
    path("users/", include("users.urls")),
    path("roles/", include("roles.urls")),
    path("permissions/", include("permissions.urls")),
    path("tenancy/", include("tenancy.urls")),
    path("audit/", include("audit.urls")),
    path("notifications/", include("notifications.urls")),
]

urlpatterns = [
    # Health / readiness probes
    path("healthz", health.liveness, name="liveness"),
    path("readyz", health.readiness, name="readiness"),
    # API surface
    path("api/v1/", include((api_v1, "v1"))),
    # OpenAPI
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/v1/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

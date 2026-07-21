from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from reporting.views import ReportExportViewSet

router = DefaultRouter()
router.register("exports", ReportExportViewSet, basename="reporting-export")

urlpatterns = [path("", include(router.urls))]

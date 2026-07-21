from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from reporting.views import ReportCatalogView, ReportExportViewSet, RunReportView

router = DefaultRouter()
router.register("exports", ReportExportViewSet, basename="reporting-export")

urlpatterns = [
    path("catalog/", ReportCatalogView.as_view(), name="reporting-catalog"),
    path("run/", RunReportView.as_view(), name="reporting-run"),
    path("", include(router.urls)),
]

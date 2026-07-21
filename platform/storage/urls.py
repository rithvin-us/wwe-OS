from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from storage.views import StoredFileViewSet, signed_download

router = DefaultRouter()
router.register("files", StoredFileViewSet, basename="storage-file")

urlpatterns = [
    path("download/", signed_download, name="storage-signed-download"),
    path("", include(router.urls)),
]

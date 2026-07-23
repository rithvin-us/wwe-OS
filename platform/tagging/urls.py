from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from tagging.views import ObjectTagsView, TagViewSet

router = DefaultRouter()
router.register("", TagViewSet, basename="tag")

urlpatterns = [
    path("for-object/", ObjectTagsView.as_view(), name="tag-for-object"),
    path("", include(router.urls)),
]

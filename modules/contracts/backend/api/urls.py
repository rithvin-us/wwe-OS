from __future__ import annotations

from contracts.backend.api.views import ContractViewSet
from django.urls import include, path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("contracts", ContractViewSet, basename="contract")

urlpatterns = [path("", include(router.urls))]

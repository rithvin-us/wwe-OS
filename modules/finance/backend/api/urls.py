from __future__ import annotations

from django.urls import include, path
from finance.backend.api.views import CustomerViewSet, InvoiceViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="finance-customer")
router.register("invoices", InvoiceViewSet, basename="finance-invoice")

urlpatterns = [path("", include(router.urls))]

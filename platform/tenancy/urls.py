from django.urls import path

from tenancy.views import CurrentCompanyProfileView, CurrentTenantView

urlpatterns = [
    path("current/", CurrentTenantView.as_view(), name="current-tenant"),
    path("company-profile/", CurrentCompanyProfileView.as_view(), name="company-profile"),
]

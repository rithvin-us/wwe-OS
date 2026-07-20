from django.urls import path

from tenancy.views import CurrentCompanyProfileView

urlpatterns = [
    path("company-profile/", CurrentCompanyProfileView.as_view(), name="company-profile"),
]

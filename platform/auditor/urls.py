from django.urls import path

from auditor.views import GenerateAuditorPackageView

urlpatterns = [
    path("packages/generate/", GenerateAuditorPackageView.as_view(), name="auditor-generate"),
]

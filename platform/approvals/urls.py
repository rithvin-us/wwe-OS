from __future__ import annotations

from django.urls import path

from approvals.views import ApprovalDecideView, ApprovalListView

urlpatterns = [
    path("", ApprovalListView.as_view(), name="approvals"),
    path("decide/", ApprovalDecideView.as_view(), name="approvals-decide"),
]

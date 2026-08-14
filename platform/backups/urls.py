from __future__ import annotations

from django.urls import path

from backups.views import BackupStatusView

urlpatterns = [
    path("", BackupStatusView.as_view(), name="backups-status"),
]

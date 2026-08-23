from __future__ import annotations

from django.urls import path

from deadlines.views import DeadlineView

urlpatterns = [
    path("", DeadlineView.as_view(), name="deadlines"),
]

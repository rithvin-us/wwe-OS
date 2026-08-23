from __future__ import annotations

from django.urls import path

from briefing.views import BriefingView

urlpatterns = [
    path("", BriefingView.as_view(), name="briefing"),
]

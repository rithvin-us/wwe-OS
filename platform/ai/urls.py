from __future__ import annotations

from django.urls import path

from ai.views import GenerateView, HealthView, PromptListView, UsageView

urlpatterns = [
    path("generate/", GenerateView.as_view(), name="ai-generate"),
    path("usage/", UsageView.as_view(), name="ai-usage"),
    path("prompts/", PromptListView.as_view(), name="ai-prompts"),
    path("health/", HealthView.as_view(), name="ai-health"),
]

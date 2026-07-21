"""AI gateway tests — prompts, routing, retry/fallback, cache, limits, API."""

from __future__ import annotations

import pytest
from ai import prompts
from ai.models import AIUsage
from ai.providers import AIRequest, MockProvider, ProviderError
from ai.services import AIService
from shared.exceptions import ConflictError, RateLimitedError, ValidationError

SUMMARY_VARS = {"sentences": "2", "text": "WWE OS is a business platform."}


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


@pytest.fixture
def no_sleep(monkeypatch):
    monkeypatch.setattr("ai.services.time.sleep", lambda seconds: None)


def _generate(tenant, **overrides):
    defaults = {"module": "test", "tenant": tenant, "user": "hello world"}
    defaults.update(overrides)
    return AIService().generate(**defaults)


# --------------------------------------------------------------------------- #
# Prompt library
# --------------------------------------------------------------------------- #


def test_prompt_renders_with_variables():
    system, user = prompts.render("generic-summary", SUMMARY_VARS)
    assert "business writing assistant" in system
    assert "at most 2 sentences" in user
    assert "WWE OS" in user


def test_prompt_rejects_missing_and_unknown_variables():
    with pytest.raises(ValidationError):
        prompts.render("generic-summary", {"sentences": "2"})
    with pytest.raises(ValidationError):
        prompts.render("generic-summary", {**SUMMARY_VARS, "bogus": "x"})


def test_prompt_registration_rejects_template_drift():
    with pytest.raises(ValidationError):
        prompts.register(
            prompts.PromptDef(
                key="drift-test",
                version=1,
                category="test",
                description="declared variable never used",
                system="No placeholders here.",
                user="None here either.",
                variables=("ghost",),
            )
        )
    assert "drift-test" not in prompts._REGISTRY


def test_prompt_duplicate_key_conflicts():
    original = prompts.get("generic-summary")
    changed = prompts.PromptDef(
        key="generic-summary",
        version=2,
        category="general",
        description="conflicting redefinition",
        system=original.system,
        user=original.user,
        variables=original.variables,
    )
    with pytest.raises(ConflictError):
        prompts.register(changed)
    prompts.register(original)  # re-registering the identical prompt is idempotent


# --------------------------------------------------------------------------- #
# Gateway
# --------------------------------------------------------------------------- #


def test_generate_with_prompt_key_records_usage(tenant):
    result = _generate(tenant, user="", prompt_key="generic-summary", variables=SUMMARY_VARS)

    assert result.text.startswith("[mock:")
    assert result.cached is False
    usage = AIUsage.objects.get()
    assert usage.module == "test"
    assert usage.use_case == "generic-summary"
    assert usage.provider == "mock"
    assert usage.success is True
    assert usage.input_tokens > 0
    assert usage.cost_usd == 0


def test_generate_rejects_unknown_model(tenant):
    with pytest.raises(ValidationError):
        _generate(tenant, model="gpt-99-ultra")


def test_cache_hit_skips_provider(tenant, monkeypatch):
    calls = []
    real = MockProvider()

    class CountingProvider(MockProvider):
        def complete(self, request: AIRequest):
            calls.append(request.model)
            return real.complete(request)

    monkeypatch.setitem(
        __import__("ai.providers", fromlist=["PROVIDERS"]).PROVIDERS, "mock", CountingProvider()
    )

    first = _generate(tenant, cache_ttl=60)
    second = _generate(tenant, cache_ttl=60)

    assert len(calls) == 1
    assert first.text == second.text
    assert second.cached is True
    assert AIUsage.objects.filter(cache_hit=True).count() == 1
    assert AIUsage.objects.count() == 2


def test_retry_recovers_from_transient_failure(tenant, monkeypatch, no_sleep):
    attempts = []

    class FlakyProvider(MockProvider):
        def complete(self, request: AIRequest):
            attempts.append(1)
            if len(attempts) == 1:
                raise ProviderError("temporary blip", retryable=True)
            return super().complete(request)

    monkeypatch.setitem(
        __import__("ai.providers", fromlist=["PROVIDERS"]).PROVIDERS, "mock", FlakyProvider()
    )

    result = _generate(tenant)
    assert result.text.startswith("[mock:")
    assert len(attempts) == 2


def test_fallback_model_on_unconfigured_provider(tenant, settings, no_sleep):
    settings.AI_FALLBACK_MODEL = "mock"

    result = _generate(tenant, model="gpt-5-mini")  # no OPENAI_API_KEY in tests

    assert result.model == "mock"
    failed = AIUsage.objects.get(success=False)
    assert failed.model == "gpt-5-mini"
    assert AIUsage.objects.filter(success=True, model="mock").count() == 1


def test_failure_without_fallback_raises_and_records(tenant, settings):
    settings.AI_FALLBACK_MODEL = ""
    with pytest.raises(ConflictError):
        _generate(tenant, model="claude-haiku-4-5")  # no ANTHROPIC_API_KEY in tests
    assert AIUsage.objects.filter(success=False, model="claude-haiku-4-5").exists()


def test_tenant_hourly_rate_limit(tenant, settings):
    settings.AI_TENANT_HOURLY_LIMIT = 1
    _generate(tenant)
    with pytest.raises(RateLimitedError):
        _generate(tenant)


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_generate_requires_permission_and_works(tenant, owner, make_user, auth_client):
    response = auth_client(owner).post(
        "/api/v1/ai/generate/", {"user": "hello platform"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["provider"] == "mock"
    assert response.data["cached"] is False

    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    denied = auth_client(nobody).post("/api/v1/ai/generate/", {"user": "hi"}, format="json")
    assert denied.status_code == 403


def test_api_usage_prompts_health(tenant, owner, auth_client):
    _generate(tenant)
    client = auth_client(owner)

    usage = client.get("/api/v1/ai/usage/")
    assert usage.status_code == 200
    assert usage.data["totals"]["calls"] == 1

    catalog = client.get("/api/v1/ai/prompts/")
    assert any(p["key"] == "generic-summary" for p in catalog.data)

    health = client.get("/api/v1/ai/health/")
    assert health.data["providers"]["mock"] is True
    assert health.data["providers"]["openai"] is False

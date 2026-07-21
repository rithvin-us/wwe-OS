"""The AI gateway.

Every AI call in the platform flows through `AIService.generate`. The service
owns: prompt resolution, model routing, tenant rate limiting, retry with
backoff, fallback model, response caching, and the usage ledger. Modules pass
a prompt key (or raw text) and get text back — providers, keys, costs, and
failure handling are invisible to them.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.cache import cache
from shared import context
from shared.exceptions import ConflictError, RateLimitedError
from shared.services import BaseService

from ai import prompts
from ai.models import AIUsage
from ai.providers import AIRequest, AIResponse, ProviderError, cost_usd, resolve

CACHE_PREFIX = "ai:response:"
RATE_PREFIX = "ai:rate:"


@dataclass(frozen=True)
class AIResult:
    text: str
    model: str
    provider: str
    cached: bool
    usage_id: Any


class AIService(BaseService):
    def generate(
        self,
        *,
        module: str,
        prompt_key: str | None = None,
        variables: dict[str, str] | None = None,
        system: str = "",
        user: str = "",
        model: str | None = None,
        use_case: str = "",
        tenant=None,
        requested_by=None,
        max_tokens: int = 1024,
        temperature: float | None = None,
        cache_ttl: int = 0,
    ) -> AIResult:
        tenant = tenant or context.current_tenant()
        if tenant is None:
            raise ConflictError("A tenant is required for AI calls.")

        if prompt_key:
            prompt = prompts.get(prompt_key)
            system, user = prompts.render(prompt_key, variables)
            use_case = use_case or prompt_key
            model = model or prompt.model_hint or settings.AI_DEFAULT_MODEL
        else:
            if not user:
                raise ConflictError("Either prompt_key or user text is required.")
            model = model or settings.AI_DEFAULT_MODEL

        self._enforce_rate_limit(tenant)
        info, provider = resolve(model)

        cache_key = ""
        if cache_ttl > 0:
            digest = hashlib.sha256(f"{model}\x00{system}\x00{user}".encode()).hexdigest()
            cache_key = f"{CACHE_PREFIX}{digest}"
            cached_text = cache.get(cache_key)
            if cached_text is not None:
                usage = self._record(
                    tenant,
                    module,
                    use_case,
                    info.provider,
                    model,
                    requested_by,
                    input_tokens=0,
                    output_tokens=0,
                    latency_ms=0,
                    cache_hit=True,
                )
                return AIResult(cached_text, model, info.provider, True, usage.id)

        request = AIRequest(
            model=model,
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        try:
            response = self._complete_with_retry(provider, request)
        except ProviderError as exc:
            self._record(
                tenant,
                module,
                use_case,
                info.provider,
                model,
                requested_by,
                success=False,
                error=str(exc)[:300],
            )
            fallback = settings.AI_FALLBACK_MODEL
            if not fallback or fallback == model:
                raise ConflictError(f"AI provider failed: {exc}") from exc
            self.logger.warning("Model %s failed (%s); falling back to %s", model, exc, fallback)
            return self.generate(
                module=module,
                system=system,
                user=user,
                model=fallback,
                use_case=use_case,
                tenant=tenant,
                requested_by=requested_by,
                max_tokens=max_tokens,
                temperature=temperature,
                cache_ttl=cache_ttl,
            )

        if cache_key:
            cache.set(cache_key, response.text, timeout=cache_ttl)
        usage = self._record(
            tenant,
            module,
            use_case,
            response.provider,
            response.model,
            requested_by,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            latency_ms=response.latency_ms,
            cost=cost_usd(info, response.input_tokens, response.output_tokens),
        )
        return AIResult(response.text, response.model, response.provider, False, usage.id)

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _complete_with_retry(self, provider, request: AIRequest) -> AIResponse:
        attempts = 1 + settings.AI_MAX_RETRIES
        last: ProviderError | None = None
        for attempt in range(1, attempts + 1):
            try:
                return provider.complete(request)
            except ProviderError as exc:
                last = exc
                if not exc.retryable or attempt == attempts:
                    raise
                self.logger.warning(
                    "AI attempt %s/%s failed (%s); retrying", attempt, attempts, exc
                )
                time.sleep(min(0.5 * attempt, 2.0))
        raise last  # pragma: no cover - loop always returns or raises

    def _enforce_rate_limit(self, tenant) -> None:
        limit = settings.AI_TENANT_HOURLY_LIMIT
        if limit <= 0:
            return
        window = time.strftime("%Y%m%d%H")
        key = f"{RATE_PREFIX}{tenant.id}:{window}"
        if not cache.add(key, 1, timeout=3600):
            try:
                count = cache.incr(key)
            except ValueError:
                count = 1
            if count > limit:
                raise RateLimitedError("AI usage limit reached for this hour.")

    def _record(
        self,
        tenant,
        module: str,
        use_case: str,
        provider: str,
        model: str,
        requested_by,
        *,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: int = 0,
        cache_hit: bool = False,
        success: bool = True,
        error: str = "",
        cost=0,
    ) -> AIUsage:
        return AIUsage.objects.create(
            tenant=tenant,
            module=module,
            use_case=use_case,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            cache_hit=cache_hit,
            success=success,
            error=error,
            requested_by=requested_by,
        )

    def provider_health(self) -> dict[str, bool]:
        """Which providers have credentials configured (never the values)."""
        from ai.providers import PROVIDERS

        return {name: provider.configured for name, provider in PROVIDERS.items()}

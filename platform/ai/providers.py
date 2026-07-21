"""AI providers and the model routing table.

One gateway rule: no module ever imports an AI SDK or calls a provider URL.
Modules call `AIService`; the service resolves a model name to a provider
through `MODELS` below. Adding a provider = one class + table entries.
Provider HTTP calls use httpx directly (no SDK dependency) — the request
shape per provider is small and stable.

Costs are USD per 1M tokens and MUST be re-verified against the provider's
pricing page before being used for anything money-shaped; they exist so the
platform can show relative spend per module/model, not to do billing.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import ClassVar

import httpx
from django.conf import settings
from shared.exceptions import ValidationError


@dataclass(frozen=True)
class AIRequest:
    model: str
    user: str
    system: str = ""
    max_tokens: int = 1024
    temperature: float | None = None
    timeout: float = 30.0


@dataclass(frozen=True)
class AIResponse:
    text: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class ProviderError(Exception):
    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class AIProvider(ABC):
    name: ClassVar[str]

    @property
    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    def complete(self, request: AIRequest) -> AIResponse: ...


def _classify_status(status_code: int, body: str) -> ProviderError:
    retryable = status_code == 429 or status_code >= 500
    return ProviderError(f"Provider returned {status_code}: {body[:300]}", retryable=retryable)


class OpenAIProvider(AIProvider):
    name = "openai"
    base_url = "https://api.openai.com/v1"

    @property
    def configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def complete(self, request: AIRequest) -> AIResponse:
        if not self.configured:
            raise ProviderError("OPENAI_API_KEY is not configured.", retryable=False)
        messages = []
        if request.system:
            messages.append({"role": "system", "content": request.system})
        messages.append({"role": "user", "content": request.user})
        payload: dict = {
            "model": request.model,
            "messages": messages,
            "max_completion_tokens": request.max_tokens,
        }
        if request.temperature is not None:
            payload["temperature"] = request.temperature

        started = time.perf_counter()
        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json=payload,
                timeout=request.timeout,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"OpenAI request failed: {exc}", retryable=True) from exc
        if response.status_code != 200:
            raise _classify_status(response.status_code, response.text)
        data = response.json()
        usage = data.get("usage", {})
        return AIResponse(
            text=data["choices"][0]["message"]["content"] or "",
            model=request.model,
            provider=self.name,
            input_tokens=int(usage.get("prompt_tokens", 0)),
            output_tokens=int(usage.get("completion_tokens", 0)),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class AnthropicProvider(AIProvider):
    name = "anthropic"
    base_url = "https://api.anthropic.com/v1"
    api_version = "2023-06-01"

    @property
    def configured(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    def complete(self, request: AIRequest) -> AIResponse:
        if not self.configured:
            raise ProviderError("ANTHROPIC_API_KEY is not configured.", retryable=False)
        payload: dict = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "messages": [{"role": "user", "content": request.user}],
        }
        if request.system:
            payload["system"] = request.system
        if request.temperature is not None:
            payload["temperature"] = request.temperature

        started = time.perf_counter()
        try:
            response = httpx.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": self.api_version,
                },
                json=payload,
                timeout=request.timeout,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Anthropic request failed: {exc}", retryable=True) from exc
        if response.status_code != 200:
            raise _classify_status(response.status_code, response.text)
        data = response.json()
        usage = data.get("usage", {})
        text = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
        return AIResponse(
            text=text,
            model=request.model,
            provider=self.name,
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class MockProvider(AIProvider):
    """Deterministic local provider — the default until real keys exist, and
    the workhorse of the test suite. Costs nothing, needs no network."""

    name = "mock"

    @property
    def configured(self) -> bool:
        return True

    def complete(self, request: AIRequest) -> AIResponse:
        text = f"[mock:{request.model}] {request.user[:200]}"
        return AIResponse(
            text=text,
            model=request.model,
            provider=self.name,
            input_tokens=len(request.user.split()) + len(request.system.split()),
            output_tokens=len(text.split()),
            latency_ms=0,
        )


@dataclass(frozen=True)
class ModelInfo:
    provider: str
    input_cost_per_mtok: Decimal
    output_cost_per_mtok: Decimal


MODELS: dict[str, ModelInfo] = {
    "mock": ModelInfo("mock", Decimal("0"), Decimal("0")),
    "gpt-5-mini": ModelInfo("openai", Decimal("0.25"), Decimal("2.00")),
    "gpt-4o": ModelInfo("openai", Decimal("2.50"), Decimal("10.00")),
    "claude-haiku-4-5": ModelInfo("anthropic", Decimal("1.00"), Decimal("5.00")),
    "claude-sonnet-4-5": ModelInfo("anthropic", Decimal("3.00"), Decimal("15.00")),
}

PROVIDERS: dict[str, AIProvider] = {
    provider.name: provider for provider in (OpenAIProvider(), AnthropicProvider(), MockProvider())
}


def resolve(model: str) -> tuple[ModelInfo, AIProvider]:
    info = MODELS.get(model)
    if info is None:
        raise ValidationError(detail={"model": [f"Unknown model '{model}'."]})
    return info, PROVIDERS[info.provider]


def cost_usd(info: ModelInfo, input_tokens: int, output_tokens: int) -> Decimal:
    per_token = Decimal(1_000_000)
    return (
        info.input_cost_per_mtok * input_tokens / per_token
        + info.output_cost_per_mtok * output_tokens / per_token
    ).quantize(Decimal("0.000001"))

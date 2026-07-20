# AI Layer

**Status: not built.** `platform/ai/` is README-only. The Telegram bot's OCR
call (built, Stage 2) is a direct, inline OpenAI call — it deliberately does
**not** yet go through a shared gateway, because there isn't one. This spec
plans that gateway; it also flags where the original brief specified
something unverifiable, rather than building against an unconfirmed fact.

## A note on model names before anything else

The brief specifies **GPT-5 mini for OCR, Claude Haiku for daily insights,
Claude Sonnet for advanced reasoning**, with a cost target of $5–6/month.
Two of those are real, current models I can confirm: **Claude Haiku 4.5**
and **Claude Sonnet 5** (or Opus 4.8 for the heaviest reasoning) are the
current Claude family. **"GPT-5 mini" I cannot confirm exists** — my
knowledge here isn't reliable enough to build against it as a fact, and
OpenAI's model lineup changes independently of this document. The gateway
below is designed so the _specific_ OCR model is a configuration value, not
a hardcoded assumption (exactly how `services/telegram-bot/main.py`'s
`OCR_MODEL` env var already works) — **verify current OpenAI model
availability and pricing before wiring a specific model id into production**,
rather than trusting this document's naming.

## 1. Functional requirements

- One gateway (`platform/ai`) every module calls for LLM/vision access —
  never a direct provider SDK call from a module (the bot's current direct
  `AsyncOpenAI` call is Stage 2 debt to migrate once this exists).
- Model routing by task shape: OCR/vision (cheap, high-volume), daily
  insight generation (cheap, scheduled), advanced reasoning (expensive,
  rare, explicit trigger only).
- Every call logged: model, tokens, cost, latency, caller (module + purpose).

## 2. Non-functional requirements

- **Cost ceiling is a design constraint, not an afterthought**: routing
  cheap tasks to cheap models is enforced by the gateway's task-type→model
  mapping, not left to each caller's judgment.
- No PII or document content persists in AI provider logs beyond what the
  provider's own retention policy already covers — the gateway logs
  metadata (tokens, cost, model), not full prompts/responses, by default.

## 3. Database schema (planned)

```
ai_call_log   id, tenant_id, module, purpose, model, provider,
              prompt_tokens, completion_tokens, cost_usd_estimate,
              latency_ms, status [ok|error|timeout], created_at
ai_prompt_template  id, key, provider, model_hint, template_text, version
```

## 4. Entity relationships

```
Module (caller) → AI gateway → {OpenAI | Anthropic} provider
                       │
                       └──> AICallLog (always, regardless of outcome)
```

## 5. Folder structure (target)

```
platform/ai/
  gateway.py        Single entry point: `ai.complete(purpose, **kwargs)`
  providers/         openai.py, anthropic.py — thin adapters, same interface
  routing.py         purpose -> (provider, model) mapping, env-overridable
  prompts/           prompt_library — versioned templates, not inline strings
  cost.py            per-provider pricing table + estimate_cost()
  retry.py           shared retry/backoff (used by both providers)
```

## 6. Backend architecture

`ai.complete(purpose="ocr.receipt", ...)` — callers name the _purpose_, never
the model. `routing.py` maps purpose to provider+model, overridable per
environment (so "gpt-4o" today can become a cheaper/newer model tomorrow by
changing one config value, not every call site — exactly the pattern already
proven in `services/telegram-bot/main.py`'s `OCR_MODEL`).

## 7. Frontend architecture

None directly — the AI Layer is backend infrastructure. The Executive
Dashboard's "AI insights" panel (`apps/web/src/config/dashboard.ts`,
currently empty) is its first consumer once daily-insight generation exists.

## 8. API design

No public HTTP API — `platform/ai` is a Python interface other backend code
calls in-process, not a service other things POST to (unlike ingestion).
If/when AI calls need to happen outside the Django process (e.g. a
scheduled job in `services/worker`), the gateway is imported there too, not
re-implemented.

## 9. Validation rules

Every prompt template declares its expected output shape; the gateway
validates the model's response against it (JSON schema for structured
extraction, matching the discipline the bot's OCR prompt already applies
manually) before returning to the caller — malformed output is a gateway
error, not a caller's problem to detect.

## 10. Business logic

Cost governance: a per-tenant monthly spend cap (configurable), with the
gateway refusing new calls (not silently degrading) once exceeded — matches
the brief's cost-consciousness with an actual enforcement mechanism, not
just a target number.

## 11. Background jobs

Daily insight generation is a scheduled job (`services/scheduler` →
`services/worker`), not triggered per-request — this is what keeps "Claude
Haiku for daily insights" cheap: one run per day per tenant, not per page
view.

## 12. Event flow

`ai.call.completed` / `.failed` / `.budget_exceeded` — the last one should
notify the operator directly (this is exactly a "needs your attention" item,
see `docs/specs/workflow-engine.md`).

## 13. Queue design

Shares the queue infrastructure from Reports/DMS (§ `reports.md` § 13) — no
separate AI-specific queue needed.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. AI-specific: never let a provider outage
take down the calling module's core function — OCR failure degrades to "ask
the human to type it in," not a 500. API keys (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`) are environment-only, already true today.

## 18. Mobile integration

The AI Assistant module (`docs/modules/ai-assistant.md`) is the natural
mobile-first surface for this layer — chat is a phone-native interaction.

## 19. Dashboard integration

"AI insights" panel — once daily-insight generation exists, this is its
direct consumer; currently an honest empty state
(`apps/web/src/app/(platform)/page.tsx`).

## 20. Future scalability

- Multi-provider fallback (if one provider is down/rate-limited, retry on
  the other) is a natural extension of `routing.py` once cost/reliability
  data justifies it.
- Per-tenant model preference (a tenant on a paid plan gets a better default
  model) fits the existing purpose→model mapping without new architecture.

# Platform · AI

Shared AI gateway: LLM provider abstraction, prompt/response logging,
embeddings, rate limits, cost tracking, model routing. Modules call AI only
through this gateway.

- Heavy inference runs in `services/ai-engine`; this component is the
  contract and client used by modules.

# Module Intelligence · AI Assistant

Route `/ai-assistant` · Domain: Automation · Status: Planned

## 1. Business purpose

Answer questions and draft actions over platform data through the shared AI gateway — "how many people are on leave next week?", "draft a PO to our usual supplier" — with permissions enforced on every answer.

## 2. Problems it solves

- Finding information requires knowing which module owns it
- Routine drafting (letters, POs, summaries) consumes staff time
- New employees don't know where anything lives
- Data questions queue on the one person who can query

## 3. Primary users

All staff (chat), executives (briefings), admins (assistant configuration and guardrails).

## 4. Future integrations

Platform AI gateway (`platform/ai`) and `services/ai-engine` · Search (retrieval) · every module's API (tools) · Telegram (chat surface).

## 5. Database entities

`conversation`, `message`, `tool_invocation_log`, `assistant_config`, `guardrail_rule`, `feedback`.

## 6. APIs

- `POST /api/assistant/conversations` · `POST /api/assistant/conversations/{id}/messages`
- `GET /api/assistant/conversations` · `POST /api/assistant/feedback`

## 7. Dashboard widgets

Conversations this week · Top intents · Tool-call success rate · Feedback score.

## 8. KPIs

Answer helpfulness rating · Deflection (questions resolved without a human) · Tool success rate · Policy-violation blocks.

## 9. Permissions

Assistant acts strictly as the asking user: every tool call passes that user's platform permissions. Module-level: `assistant.use`, `assistant.configure`, `assistant.logs.read`.

## 10. Navigation structure

Chat · History · Configuration (admin).

## 11. Relationships with other modules

Reads through Search and module APIs, writes only via module APIs with explicit user confirmation; all model traffic goes through the platform AI gateway for logging, cost, and rate control.

## 12. AI opportunities

This module is the AI surface itself; its own roadmap: retrieval over DMS, cross-module briefings, action drafting with confirm-to-execute, scheduled digests.

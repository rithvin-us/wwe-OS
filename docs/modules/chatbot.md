# Module Intelligence · Chatbot

Route: served through AI Assistant (`/ai-assistant`) and Telegram surfaces · Status: Planned

> Kept as a separate blueprint because `modules/chatbot` exists in the backend
> skeleton; in product terms it is the conversational delivery layer of the
> AI Assistant across chat surfaces (web widget, Telegram).

## 1. Business purpose

Provide a conversational interface over platform data and actions wherever employees already chat, using the AI Assistant's brain and the platform's permissions.

## 2. Problems it solves

Same class as AI Assistant, plus: employees outside the web app (field, mobile-first) get platform access; simple lookups don't require navigating modules.

## 3. Primary users

All staff via chat surfaces; admins configuring surfaces and scopes.

## 4. Future integrations

AI Assistant (conversation engine), Telegram bot (surface), future web chat widget, Notifications (handover alerts).

## 5. Database entities

`chat_surface`, `surface_binding` (surface ↔ assistant config), `session_link`; conversation storage shared with AI Assistant.

## 6. APIs

- `POST /api/chatbot/sessions` · `POST /api/chatbot/sessions/{id}/messages`
- `GET /api/chatbot/surfaces` (admin)

## 7. Dashboard widgets

Sessions by surface · Resolution without handover · Active surfaces.

## 8. KPIs

Resolution rate · Handover rate to humans · Latency per reply · User rating.

## 9. Permissions

Identical model to AI Assistant: the bot acts as the authenticated user; `chatbot.surface.manage` for admins.

## 10. Navigation structure

Managed inside AI Assistant configuration; no separate sidebar entry.

## 11. Relationships with other modules

Thin delivery layer: AI Assistant provides reasoning and tools; Telegram service provides transport; identity via platform auth links.

## 12. AI opportunities

Multi-turn task completion in chat · Proactive nudges (pending approvals) · Voice input on mobile surfaces.

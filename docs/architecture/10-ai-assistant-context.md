# 10. AI Assistant Context & Prompt Guide

This file provides a high-density reference for AI coding assistants (GPT-4, Claude, Antigravity) working on the WWE OS repository.

---

## High-Density System Summary

- **Repository:** Single-operator Enterprise Business Operations Platform (`rithvin-us/wwe-OS`).
- **Stack:** Next.js 16 (App Router, Tailwind CSS v4) + Django 5 REST Framework + PostgreSQL 16 + Redis 7 + Docker.
- **Backend Container:** `bop-backend` (Django API on port 8000).
- **Primary Domain Features:**
  - Delivery Challan Engine (`/assets`): Dynamic Word template rendering (`dc_template.docx` / `DC 26.docx`), free-text items, custom measurement units (Kg, Litre, Lot, Nos, Mtr), free-text deliver-to address, SHA-256 document hashing (`verification_hash`), deletion, PDF downloads, and `DCAnalytics` summary banner.
  - Receipt Ingestion (`/purchase`): Telegram bot (`bop-telegram-bot`) + OpenAI Vision OCR.
  - Inventory (`/inventory`): Stock receiving/issuing (low-stock checks removed).
  - DMS (`/dms`): File storage & AI summarization (approval states removed).

---

## Mandatory AI Coding Rules

1. **Zero Ad-Hoc Infrastructure:**
   - Always call `StorageService().store(...)` for files.
   - Always call `AIService().generate(...)` for AI models.
   - Always inherit `TenantOwnedModel` for tenant database models.
2. **Container Hot-Reloading:**
   - After editing Python code, run `docker restart bop-backend`.
3. **DRF Tenant Scoping:**
   - In ViewSets, check `if user.is_superuser or user.tenant_id is None:` to return `.all()`.
4. **Server Actions:**
   - Return plain response objects `{ success: boolean, error?: string, details?: any }` to prevent Next.js error masking.
5. **No Code Modifications for Pure Documentation Tasks:**
   - Respect task boundaries when requested to perform documentation-only tasks.

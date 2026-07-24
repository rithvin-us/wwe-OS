# Search Platform — Design

**Status:** Approved 2026-07-24 (Business Operations Orchestrator roadmap) — implementation in progress.
**Scope:** Subsystem 8. Metadata-first faceted search over what Subsystems 2-4 already produce.

## 1. Context — the search infrastructure is already fully generic

`platform/search` (`SearchService`, `SearchDocument`) already supports everything the roadmap asks for at the infrastructure level:

- **Faceting and filtering are already generic over `extra`** — `SearchService.search(facets=[...], filters={...})` groups/filters on any key inside `SearchDocument.extra` (a plain JSONField), with zero index-specific code (`search/services.py` `_ranked`/facet-counting loops). `SearchView` already turns any `?filter.<key>=<value>` query param into `extra__<key>` filtering (`search/views.py`).
- **Natural-language / free-text search already works** — full-text ranking (Postgres `SearchVector`/`SearchRank`, or a portable `icontains` fallback) over `title`+`body`, which each adapter already folds description/summary/tags into.
- **Permission-gated, tenant-scoped, paginated, autocomplete** — all built (Subsystem-independent of this roadmap).

**The actual gap**: `documents`' and `purchase`'s `to_document()` adapters (`modules/*/backend/search/adapter.py`) only populate `extra` with `status`/`category`/`payment_status` today — none of the business period, vendor, or source-channel data Subsystems 2-4 now produce is in there. "Business period search," "vendor search," "source search," "document type" from the roadmap are all satisfied by putting those fields into `extra` — no `platform/search` change needed at all. Building new search infrastructure here would duplicate a capability that already exists and works.

## 2. Design

**a) Standardize the facet key `document_type` across indexes.** Today `documents` uses `extra["category"]`; nothing else uses that key. Renaming it to `document_type` (verified no test/frontend code depends on the old key name) means a future single "Document Type" facet UI filters both the `documents` and `purchase` indexes with the same query param, instead of two different key names for the same concept.

**b) Each adapter adds only the facets it actually has.** `documents`: `document_type` (was `category`), `period_year`, `period_month`, `is_library` — read off `Document.file` (already an FK, `select_related("file")` added to the adapter's `queryset()` to avoid N+1 on rebuild). `purchase`: `document_type` (constant `"purchase_bill"`), `vendor`, `source_channel`, `period_year`, `period_month`, `is_library` — the period/library fields are looked up from `StoredFile` by `storage_key` (same lookup pattern `purchase/backend/metadata_provider.py` already established in Subsystem 4 — not a new pattern). No `employee` facet — no `Employee` model exists (unchanged from Subsystems 3/4). No `vendor` facet on `documents` — `Document` has no vendor concept; only `purchase` bills do.

**c) "Natural language search" is the existing free-text ranking, not a new NLU layer.** Building intent-parsing (a query like "invoices from Acme last month" → structured filters) would mean a new AI-driven query layer — speculative, untested-pattern, real cost/latency tradeoffs, and nothing in the approved subsystems before this one asked for it. The roadmap's plain reading ("search bar, type what you mean, get results") is already satisfied by ranked full-text search over title/body, which already includes vendor names, invoice numbers, categories, and tags (folded into `body` by both adapters already). Flagged explicitly as out of scope rather than silently skipped.

## 3. Out of scope

New `platform/search` code (none needed); an NLU/intent-parsing query layer; an `employee` facet; a `vendor` facet on the `documents` index; a unified cross-index "search everything" UI (Subsystem 10).

## 4. Test plan

- Additive cases in `test_documents.py`: a document's search entry carries `document_type`/`period_year`/`period_month`/`is_library` in `extra`; filtering search results by `filter.document_type` returns it.
- Additive cases in `test_ingest.py`: a bill's search entry carries `vendor`/`source_channel`/`period_year`/`period_month` in `extra`.
- No changes to `platform/tests/test_search.py` — the platform's own generic faceting/filtering is proven there already and stays untouched.

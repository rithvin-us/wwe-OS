# 04. Integration Rules & Architectural Constraints

To maintain system integrity, scalability, and maintainability, all developers and AI assistants must strictly follow these integration rules.

---

## Rule 1: Mandatory Consumption of Platform Services

Business modules (`modules/*`) **MUST NOT** implement their own file handling, AI API clients, search engines, or audit logging. They **MUST** consume platform shared services.

| Infrastructure Task | Forbidden Pattern | Mandatory Platform Service |
| :--- | :--- | :--- |
| **File Storage** | Direct filesystem writes / custom AWS S3 SDK imports | `StorageService().store(...)` |
| **AI Generation** | Direct `import openai` / `import anthropic` | `AIService().generate(...)` |
| **Search** | Custom SQL `LIKE` queries across module tables | `SearchService().upsert(...)` / `search()` |
| **PDF/Export Generation** | Raw `reportlab` / `csv` handling in modules | `ReportService().export(...)` |
| **Audit Logging** | Manual table writes for security actions | `publish(event)` -> Event Bus Subscriber |

---

## Rule 2: Multi-Tenancy Data Scoping

1. **Model Inheritance:** Every database model that belongs to a tenant MUST derive from `shared.models.TenantOwnedModel`.
2. **Automatic Stamping:** `TenantOwnedModel` automatically stamps the current thread-local tenant on `save()`.
3. **DRF Queryset Handling:** ViewSets MUST implement `get_queryset()` safely. When a user has `user.tenant_id is None` (e.g. superuser or dev mode account without bound tenant), `get_queryset()` MUST return `Model.objects.all()` rather than `Model.objects.none()` so users are not blocked with `404 Not Found` errors during retrieval, update, or deletion.

```python
# Correct ViewSet Pattern
def get_queryset(self):
    if getattr(self, "swagger_fake_view", False):
        return Model.objects.none()
    user = self.request.user
    if user.is_superuser or user.tenant_id is None:
        return Model.objects.all()
    return Model.objects.filter(tenant_id=user.tenant_id)
```

---

## Rule 3: Next.js Server Action Error Handling

Next.js 15+ `"use server"` actions mask custom JavaScript error properties when errors are thrown across the server/client boundary.

1. **Structured Error Envelopes:** Server actions MUST catch backend errors and return plain response objects `{ success: boolean, error?: string, details?: any }`.
2. **Never Throw Custom Error Classes Across Boundaries:** Do not rely on `throw new CustomApiError()` inside server actions without catching it and returning a structured response object.

```typescript
// Correct Server Action Pattern
export async function myAction(payload: MyInput) {
  try {
    const res = await djangoFetch("/api/v1/resource/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { success: true, data: res };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Operation failed",
      details: err.details,
    };
  }
}
```

---

## Rule 4: Container Memory Reloading

Gunicorn running inside the `bop-backend` Docker container does **not** auto-reload Python source files when code is edited on mounted disk volumes.

- Whenever Python code in `platform/`, `modules/`, or `config/` is updated, **`docker restart bop-backend`** MUST be executed for changes to take effect in memory.

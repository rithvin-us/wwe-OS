import { djangoFetch, djangoFetchPage } from "@/lib/api/server";

export interface TenantConfig {
  gemini_api_key?: string;
  openai_api_key?: string;
  ocr_model?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from?: string;
  [key: string]: unknown;
}

export interface AIUsageTotals {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AIUsageByModule {
  module: string;
  calls: number;
  cost_usd: number;
}

export async function getTenantConfig(): Promise<{ config: TenantConfig }> {
  try {
    return await djangoFetch<{ config: TenantConfig }>("/api/v1/tenancy/current/");
  } catch {
    return { config: {} };
  }
}

export async function getAIUsage(): Promise<{
  totals: AIUsageTotals;
  by_model: unknown[];
  by_module: AIUsageByModule[];
}> {
  try {
    return await djangoFetch<{
      totals: AIUsageTotals;
      by_model: unknown[];
      by_module: AIUsageByModule[];
    }>("/api/v1/ai/usage/");
  } catch {
    return {
      totals: { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      by_model: [],
      by_module: [],
    };
  }
}

// --------------------------------------------------------------------------- //
// Runtime status — what's actually running right now (deploy identity,
// effective AI/PDF config, DB+cache reachability, request counts).
// --------------------------------------------------------------------------- //
export interface RuntimeStatus {
  deploy: {
    commit: string | null;
    branch: string | null;
    service: string | null;
    on_render: boolean;
  };
  config: {
    debug: boolean;
    ai_default_model: string;
    ai_fallback_model: string | null;
    invoice_pdf_engine: string;
    metrics_scrape_configured: boolean;
  };
  checks: { database?: string; cache?: string };
  requests: {
    requests_by_status: Record<string, number>;
    total_requests: number;
    avg_duration_ms: number | null;
    note: string;
  };
}

const FALLBACK_RUNTIME_STATUS: RuntimeStatus = {
  deploy: { commit: null, branch: null, service: null, on_render: false },
  config: {
    debug: false,
    ai_default_model: "unknown",
    ai_fallback_model: null,
    invoice_pdf_engine: "unknown",
    metrics_scrape_configured: false,
  },
  checks: {},
  requests: { requests_by_status: {}, total_requests: 0, avg_duration_ms: null, note: "" },
};

export async function getRuntimeStatus(): Promise<{ data: RuntimeStatus; reachable: boolean }> {
  try {
    const data = await djangoFetch<RuntimeStatus>("/api/v1/ops/status/");
    return { data, reachable: true };
  } catch {
    return { data: FALLBACK_RUNTIME_STATUS, reachable: false };
  }
}

// --------------------------------------------------------------------------- //
// AI gateway operations — real success/failure signal, not "is a key set".
// --------------------------------------------------------------------------- //
export interface AIFailure {
  module: string;
  use_case: string;
  provider: string;
  model: string;
  error: string;
  created_at: string;
}

export interface AIOperations {
  window: string;
  calls: number;
  failures: number;
  success_rate: number | null;
  by_model: Array<{ model: string; calls: number; failures: number }>;
  recent_failures: AIFailure[];
}

const EMPTY_AI_OPERATIONS: AIOperations = {
  window: "24h",
  calls: 0,
  failures: 0,
  success_rate: null,
  by_model: [],
  recent_failures: [],
};

export async function getAIOperations(): Promise<AIOperations> {
  try {
    return await djangoFetch<AIOperations>("/api/v1/ai/operations/");
  } catch {
    return EMPTY_AI_OPERATIONS;
  }
}

// --------------------------------------------------------------------------- //
// Face check-in engine diagnostics — same checks as `manage.py face_doctor`.
// --------------------------------------------------------------------------- //
export interface FaceDiagnostics {
  status: "healthy" | "warning" | "broken";
  config: Record<string, unknown>;
  gallery: { enrolled: number; unreadable: number; dimensions: Record<string, number> };
  live: Record<string, unknown>;
  problems: string[];
  warnings: string[];
}

export async function getFaceDiagnostics(): Promise<FaceDiagnostics | null> {
  try {
    return await djangoFetch<FaceDiagnostics>("/api/v1/hr/face/diagnostics/");
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------- //
// Current business period — is this month locked for edits.
// --------------------------------------------------------------------------- //
export interface CurrentPeriod {
  year: number;
  month: number;
  status?: string;
  is_locked?: boolean;
  locked_at?: string | null;
}

export async function getCurrentPeriod(): Promise<CurrentPeriod | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  try {
    const res = await djangoFetch<CurrentPeriod & { data?: null }>(
      `/api/v1/periods/${year}/${month}/`,
    );
    if (!res || res.data === null) return null;
    return res;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------- //
// Recent activity — the audit trail, most recent first.
// --------------------------------------------------------------------------- //
export interface AuditEntry {
  id: string;
  action: string;
  module: string;
  object_type: string;
  object_id: string;
  created_at: string;
}

export async function getRecentActivity(limit = 12): Promise<AuditEntry[]> {
  try {
    const { data } = await djangoFetchPage<AuditEntry[]>(`/api/v1/audit/?page_size=${limit}`);
    return data;
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------- //
// Real usage counts for the Integrations tab — one cheap page_size=1 request
// per integration, reading only the pagination count. Never fabricate: a
// failed or unreachable call returns null, so the caller can render nothing
// rather than a guess.
// --------------------------------------------------------------------------- //
async function count(path: string): Promise<number | null> {
  try {
    const { meta } = await djangoFetchPage<unknown[]>(path);
    return meta.count;
  } catch {
    return null;
  }
}

export async function getTelegramBillsCount(): Promise<number | null> {
  return count("/api/v1/purchase/bills/?source_channel=telegram&page_size=1");
}

export async function getNotificationsSentCount(): Promise<number | null> {
  return count("/api/v1/notifications/?page_size=1");
}

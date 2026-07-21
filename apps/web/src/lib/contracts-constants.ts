// Client-safe contract types, constants, and pure helpers. No server-only
// imports — client components import from here; server fetchers live in
// ./contracts and re-export everything below.

export type ContractStatus = "draft" | "in_review" | "active" | "expired" | "terminated";
export type ContractCategory =
  | "service"
  | "lease"
  | "nda"
  | "employment"
  | "supply"
  | "license"
  | "other";
export type SummaryStatus = "none" | "ready" | "failed";

export interface ContractRecord {
  id: string;
  title: string;
  counterparty: string;
  category: ContractCategory;
  category_label: string;
  status: ContractStatus;
  status_label: string;
  value: string | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  renewal_notice_days: number;
  notes: string;
  ai_summary: string;
  summary_status: SummaryStatus;
  file_name: string | null;
  owner_email: string | null;
  days_to_expiry: number | null;
  is_expiring_soon: boolean;
  reviewed_at: string | null;
  terminated_at: string | null;
  termination_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ContractStats {
  draft: number;
  in_review: number;
  active: number;
  expired: number;
  terminated: number;
  total: number;
  expiring_soon: number;
  active_value: string;
}

export interface ContractCreateInput {
  title: string;
  counterparty: string;
  category: ContractCategory;
  value: string | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  renewal_notice_days: number;
  notes: string;
}

export const CONTRACT_CATEGORIES: { value: ContractCategory; label: string }[] = [
  { value: "service", label: "Service agreement" },
  { value: "lease", label: "Lease" },
  { value: "nda", label: "NDA" },
  { value: "employment", label: "Employment" },
  { value: "supply", label: "Supply" },
  { value: "license", label: "License" },
  { value: "other", label: "Other" },
];

export function formatMoney(value: string | null, currency: string): string {
  if (value === null || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Client-safe asset types, constants, and pure helpers. No server-only imports.

export type AssetStatus = "in_stock" | "assigned" | "in_maintenance" | "disposed";
export type AssetCategory =
  | "it_equipment"
  | "furniture"
  | "vehicle"
  | "machinery"
  | "tool"
  | "other";

export interface AssetRecord {
  id: string;
  name: string;
  asset_tag: string;
  category: AssetCategory;
  category_label: string;
  status: AssetStatus;
  status_label: string;
  serial_number: string;
  purchase_date: string | null;
  purchase_cost: string | null;
  currency: string;
  supplier: string;
  location: string;
  assigned_to: string;
  assigned_at: string | null;
  file_name: string | null;
  disposed_at: string | null;
  disposal_reason: string;
  disposal_proceeds: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AssetMaintenanceRecord {
  id: string;
  performed_on: string;
  description: string;
  cost: string | null;
  currency: string;
  vendor: string;
  actor_email: string | null;
  created_at: string;
}

export interface AssetStats {
  in_stock: number;
  assigned: number;
  in_maintenance: number;
  disposed: number;
  total: number;
  active_value: string;
}

export interface AssetCreateInput {
  name: string;
  asset_tag: string;
  category: AssetCategory;
  serial_number: string;
  purchase_date: string | null;
  purchase_cost: string | null;
  currency: string;
  supplier: string;
  location: string;
  notes: string;
}

export const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "it_equipment", label: "IT equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "vehicle", label: "Vehicle" },
  { value: "machinery", label: "Machinery" },
  { value: "tool", label: "Tool" },
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

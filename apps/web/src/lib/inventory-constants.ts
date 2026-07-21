// Client-safe inventory types, constants, and pure helpers. No server-only
// imports — client components import from here; server fetchers live in
// ./inventory and re-export everything below.

export type MovementType = "receipt" | "issue" | "adjustment";

export interface InventoryItemRecord {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity_on_hand: string;
  unit_cost: string | null;
  currency: string;
  location: string;
  supplier: string;
  is_active: boolean;
  notes: string;
  stock_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovementRecord {
  id: string;
  movement_type: MovementType;
  movement_label: string;
  delta: string;
  balance_after: string;
  reason: string;
  reference: string;
  actor_email: string | null;
  created_at: string;
}

export interface InventoryStats {
  total_items: number;
  active: number;
  inactive: number;
  stock_value: string;
}

export interface ItemCreateInput {
  name: string;
  sku: string;
  category: string;
  unit: string;
  unit_cost: string | null;
  currency: string;
  location: string;
  supplier: string;
  notes: string;
}

export function formatQty(quantity: string, unit: string): string {
  const value = Number(quantity);
  const shown = Number.isInteger(value) ? String(value) : quantity;
  return `${shown} ${unit}`;
}

export function formatMoney(value: string | null, currency: string): string {
  if (value === null || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

import { djangoFetch } from "@/lib/api/server";
import type {
  InventoryItemRecord,
  InventoryStats,
  StockMovementRecord,
} from "@/lib/inventory-constants";

// Re-export the client-safe types/constants so server callers have one import.
export * from "@/lib/inventory-constants";

export async function getItems(params: { category?: string } = {}) {
  const query = new URLSearchParams({ page_size: "100", ordering: "name" });
  if (params.category) query.set("category", params.category);
  return djangoFetch<InventoryItemRecord[]>(`/api/v1/inventory/items/?${query.toString()}`);
}

export async function getItem(id: string) {
  return djangoFetch<InventoryItemRecord>(`/api/v1/inventory/items/${id}/`);
}

export async function getItemMovements(id: string) {
  return djangoFetch<StockMovementRecord[]>(`/api/v1/inventory/items/${id}/movements/`);
}

export async function getInventoryStats() {
  return djangoFetch<InventoryStats>("/api/v1/inventory/items/stats/");
}

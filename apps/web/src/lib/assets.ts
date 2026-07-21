import { djangoFetch } from "@/lib/api/server";
import type {
  AssetMaintenanceRecord,
  AssetRecord,
  AssetStats,
  AssetStatus,
} from "@/lib/assets-constants";

// Re-export the client-safe types/constants so server callers have one import.
export * from "@/lib/assets-constants";

export async function getAssets(params: { status?: AssetStatus } = {}) {
  const query = new URLSearchParams({ page_size: "100", ordering: "asset_tag" });
  if (params.status) query.set("status", params.status);
  return djangoFetch<AssetRecord[]>(`/api/v1/assets/assets/?${query.toString()}`);
}

export async function getAsset(id: string) {
  return djangoFetch<AssetRecord>(`/api/v1/assets/assets/${id}/`);
}

export async function getAssetMaintenance(id: string) {
  return djangoFetch<AssetMaintenanceRecord[]>(`/api/v1/assets/assets/${id}/maintenance/`);
}

export async function getAssetStats() {
  return djangoFetch<AssetStats>("/api/v1/assets/assets/stats/");
}

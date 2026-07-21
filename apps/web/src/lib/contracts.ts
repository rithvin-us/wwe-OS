import { djangoFetch } from "@/lib/api/server";
import type {
  ContractCategory,
  ContractRecord,
  ContractStats,
  ContractStatus,
} from "@/lib/contracts-constants";

// Re-export the client-safe types/constants so server callers have one import.
export * from "@/lib/contracts-constants";

export async function getContracts(
  params: { status?: ContractStatus; category?: ContractCategory } = {},
) {
  const query = new URLSearchParams({ page_size: "100", ordering: "-created_at" });
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("category", params.category);
  return djangoFetch<ContractRecord[]>(`/api/v1/contracts/contracts/?${query.toString()}`);
}

export async function getContract(id: string) {
  return djangoFetch<ContractRecord>(`/api/v1/contracts/contracts/${id}/`);
}

export async function getContractStats() {
  return djangoFetch<ContractStats>("/api/v1/contracts/contracts/stats/");
}

import type { DeliveryChallan, GenerateDCInput, Site } from "@bop/shared-types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api, API_URL } from "@/lib/api";
import { secureTokenStorage } from "@/lib/token-storage";

export function getSites() {
  return api.request<Site[]>("/api/v1/assets/sites/");
}

export function getDCs() {
  return api.request<DeliveryChallan[]>("/api/v1/assets/dcs/");
}

export function generateDC(input: GenerateDCInput) {
  return api.request<DeliveryChallan>("/api/v1/assets/dcs/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteDC(id: string) {
  return api.request<null>(`/api/v1/assets/dcs/${id}/`, { method: "DELETE" });
}

/** GET, JWT-gated binary passthrough — same download-and-share pattern as every other module. */
export async function openDCPdf(id: string): Promise<void> {
  const token = await secureTokenStorage.getAccessToken();
  const file = await File.downloadFileAsync(
    `${API_URL}/api/v1/assets/dcs/${id}/download/`,
    Paths.cache,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      idempotent: true,
    },
  );
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}

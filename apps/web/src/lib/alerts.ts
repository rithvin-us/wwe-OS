import { djangoFetch } from "@/lib/api/server";
import type { AlertRule } from "@/config/alerts";

export type { AlertRule } from "@/config/alerts";

export async function getAlertRules(): Promise<AlertRule[]> {
  try {
    return await djangoFetch<AlertRule[]>(
      "/api/v1/alerts/rules/?ordering=-created_at&page_size=100",
    );
  } catch {
    return [];
  }
}

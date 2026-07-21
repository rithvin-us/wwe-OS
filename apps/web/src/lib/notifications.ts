import { djangoFetch } from "@/lib/api/server";
import type { NotificationRecord, NotificationStatus } from "@/lib/notifications-constants";

// Re-export the client-safe types/helpers so server callers have one import.
export * from "@/lib/notifications-constants";

export async function getNotifications(params: { status?: NotificationStatus } = {}) {
  const query = new URLSearchParams({ page_size: "100", ordering: "-created_at" });
  if (params.status) query.set("status", params.status);
  return djangoFetch<NotificationRecord[]>(`/api/v1/notifications/?${query.toString()}`);
}

export async function getUnreadCount() {
  return djangoFetch<{ unread: number }>("/api/v1/notifications/unread-count/");
}

import { djangoFetch } from "@/lib/api/server";
import type { NotificationRecord } from "@/lib/notifications-constants";

/**
 * BFF for the header notification bell (a client component that can't call the
 * server-only djangoFetch directly). Returns the recent notifications plus the
 * unread count in one round-trip; the token stays in the httpOnly cookie.
 */
export async function GET(): Promise<Response> {
  try {
    const [items, count] = await Promise.all([
      djangoFetch<NotificationRecord[]>("/api/v1/notifications/?page_size=8&ordering=-created_at"),
      djangoFetch<{ unread: number }>("/api/v1/notifications/unread-count/"),
    ]);
    return Response.json({ items, unread: count.unread });
  } catch {
    return Response.json({ items: [], unread: 0 }, { status: 200 });
  }
}

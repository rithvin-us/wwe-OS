import { djangoFetch } from "@/lib/api/server";

export async function GET(): Promise<Response> {
  try {
    const res = await djangoFetch<{ key: string | null }>(
      "/api/v1/notifications/push/vapid-public-key/",
    );
    return Response.json({ key: res.key });
  } catch {
    return Response.json({ key: null }, { status: 500 });
  }
}

import { djangoFetch } from "@/lib/api/server";

export async function POST(): Promise<Response> {
  try {
    await djangoFetch("/api/v1/notifications/read-all/", { method: "POST" });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

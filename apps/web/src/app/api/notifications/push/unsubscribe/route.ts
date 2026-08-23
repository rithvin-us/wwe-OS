import { djangoFetch } from "@/lib/api/server";

export async function POST(request: Request): Promise<Response> {
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  try {
    await djangoFetch("/api/v1/notifications/push/unsubscribe/", {
      method: "POST",
      body: JSON.stringify({ endpoint: body.endpoint || "" }),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unsubscribe failed." },
      { status: 500 },
    );
  }
}

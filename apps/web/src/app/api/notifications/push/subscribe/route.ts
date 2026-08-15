import { djangoFetch } from "@/lib/api/server";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid subscription payload." }, { status: 400 });
  }

  try {
    await djangoFetch("/api/v1/notifications/push/subscribe/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Subscribe failed." },
      { status: 500 },
    );
  }
}

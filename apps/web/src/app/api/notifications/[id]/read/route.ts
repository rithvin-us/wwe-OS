import { djangoFetch } from "@/lib/api/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    await djangoFetch(`/api/v1/notifications/${id}/read/`, { method: "POST" });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

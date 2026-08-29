import { proxyToDjango } from "@/lib/api/proxy";

/** Totals the current (unsaved) draft would produce. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = await request.text();
  return proxyToDjango(`/api/v1/finance/invoice-import-items/${id}/recompute/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

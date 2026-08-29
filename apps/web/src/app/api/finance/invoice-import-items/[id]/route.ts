import { proxyToDjango } from "@/lib/api/proxy";

/** Save an operator edit to an item's draft. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = await request.text();
  return proxyToDjango(`/api/v1/finance/invoice-import-items/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

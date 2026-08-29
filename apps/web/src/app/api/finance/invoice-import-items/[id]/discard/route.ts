import { proxyToDjango } from "@/lib/api/proxy";

/** Drop an item from the batch without committing it. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxyToDjango(`/api/v1/finance/invoice-import-items/${id}/discard/`, { method: "POST" });
}

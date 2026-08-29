import { proxyToDjango } from "@/lib/api/proxy";

/** Back-fill this item into the register under its printed number. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxyToDjango(`/api/v1/finance/invoice-import-items/${id}/commit/`, { method: "POST" });
}

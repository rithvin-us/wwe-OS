import { proxyToDjango } from "@/lib/api/proxy";

/** The original uploaded scan, served inline (the browser holds no Django token). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxyToDjango(`/api/v1/finance/invoice-import-items/${id}/scan/`);
}

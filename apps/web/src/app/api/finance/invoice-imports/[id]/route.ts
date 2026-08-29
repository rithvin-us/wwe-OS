import { proxyToDjango } from "@/lib/api/proxy";

/** One import batch with its items — polled by the review grid while OCR runs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxyToDjango(`/api/v1/finance/invoice-imports/${id}/`);
}

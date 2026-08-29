import { proxyToDjango } from "@/lib/api/proxy";

/** Commit every reviewable item in the batch into the register. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxyToDjango(`/api/v1/finance/invoice-imports/${id}/commit/`, { method: "POST" });
}

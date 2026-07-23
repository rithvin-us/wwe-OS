import { searchCatalog } from "@/lib/search";

/**
 * BFF for the command palette (a client component that can't call the
 * server-only djangoFetch directly). Kept to a small page size — the palette
 * shows a handful of results per group and points to /search for the rest.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const data = await searchCatalog({
    q: searchParams.get("q") ?? "",
    page_size: Number(searchParams.get("page_size")) || 8,
  });
  return Response.json(data);
}

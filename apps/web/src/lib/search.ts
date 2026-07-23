import { djangoFetch } from "@/lib/api/server";

export interface SearchResultRow {
  index: string;
  doc_id: string;
  title: string;
  excerpt: string;
  url: string;
  extra: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResultRow[];
  meta: { count: number; page: number; pages: number };
  facets: Record<string, { value: string; count: number }[]>;
}

const EMPTY_RESPONSE: SearchResponse = {
  results: [],
  meta: { count: 0, page: 1, pages: 0 },
  facets: {},
};

export async function searchCatalog(params: {
  q: string;
  page?: number;
  page_size?: number;
}): Promise<SearchResponse> {
  if (!params.q.trim()) return EMPTY_RESPONSE;
  const query = new URLSearchParams({ q: params.q });
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  try {
    return await djangoFetch<SearchResponse>(`/api/v1/search/?${query.toString()}`);
  } catch {
    return EMPTY_RESPONSE;
  }
}

// Tag data-fetchers — server-only (djangoFetch pulls in "server-only").
// Used by any module's Server Component that needs the tag vocabulary or an
// object's current tags. Mutations live in ./tags-actions (client-callable).

import { djangoFetch } from "@/lib/api/server";

export type TagColor = "blue" | "green" | "amber" | "violet" | "rose";

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  usage_count?: number | null;
  created_at?: string;
}

export async function listTags(search = ""): Promise<Tag[]> {
  try {
    const query = search ? `?q=${encodeURIComponent(search)}` : "";
    return await djangoFetch<Tag[]>(`/api/v1/tags/${query}`);
  } catch {
    return [];
  }
}

export async function getObjectTags(
  module: string,
  objectType: string,
  objectId: string,
): Promise<Tag[]> {
  try {
    const params = new URLSearchParams({
      module,
      object_type: objectType,
      object_id: objectId,
    });
    return await djangoFetch<Tag[]>(`/api/v1/tags/for-object/?${params.toString()}`);
  } catch {
    return [];
  }
}

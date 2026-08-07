import type { SetObjectTagsPayload, Tag } from "@bop/shared-types";

import { api } from "@/lib/api";

export function listTags(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return api.request<Tag[]>(`/api/v1/tags/${query}`);
}

export function getObjectTags(module: string, objectType: string, objectId: string) {
  const query = new URLSearchParams({ module, object_type: objectType, object_id: objectId });
  return api.request<Tag[]>(`/api/v1/tags/for-object/?${query}`);
}

/** Full replace, not a merge — matches TagService.set_tags_for_object on the backend. */
export function setObjectTags(payload: SetObjectTagsPayload) {
  return api.request<Tag[]>("/api/v1/tags/for-object/", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

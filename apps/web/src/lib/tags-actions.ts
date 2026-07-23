"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";
import type { Tag } from "@/lib/tags";

export interface SetObjectTagsResult {
  ok: boolean;
  message: string;
  tags: Tag[];
}

/**
 * Client-callable fetch for one object's tags — for dialogs/panels that open
 * client-side (no Server Component re-render to carry fresh props through),
 * e.g. the purchase bill details dialog. Server Components should call
 * `getObjectTags` from ./tags directly instead of this.
 */
export async function getObjectTagsAction(
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

/**
 * Replaces the full tag set on one object — the one mutation every module's
 * tag picker calls (see packages/ui/src/components/tag-picker.tsx). `revalidate`
 * is the route(s) to refresh afterwards, since this file is shared across
 * every module rather than living under one route's own actions.ts.
 */
export async function setObjectTagsAction(
  module: string,
  objectType: string,
  objectId: string,
  tagIds: string[],
  tagNames: string[],
  revalidate: string | string[] = [],
): Promise<SetObjectTagsResult> {
  try {
    const tags = await djangoFetch<Tag[]>("/api/v1/tags/for-object/", {
      method: "PUT",
      body: JSON.stringify({
        module,
        object_type: objectType,
        object_id: objectId,
        tag_ids: tagIds,
        tag_names: tagNames,
      }),
    });
    for (const path of Array.isArray(revalidate) ? revalidate : [revalidate]) {
      revalidatePath(path);
    }
    return { ok: true, message: "Tags updated.", tags };
  } catch (error) {
    const message = error instanceof ApiRequestError ? error.message : "Could not update tags.";
    return { ok: false, message, tags: [] };
  }
}

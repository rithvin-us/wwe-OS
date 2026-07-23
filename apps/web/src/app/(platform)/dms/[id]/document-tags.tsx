"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { TagPicker, type TagPickerChange } from "@bop/ui/components/tag-picker";
import type { TagLike } from "@bop/ui/components/tag-pill";

import { setObjectTagsAction } from "@/lib/tags-actions";

export function DocumentTags({
  documentId,
  tags,
  allTags,
}: {
  documentId: string;
  tags: TagLike[];
  allTags: TagLike[];
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(next: TagPickerChange) {
    startTransition(async () => {
      const result = await setObjectTagsAction(
        "documents",
        "Document",
        documentId,
        next.tagIds,
        next.tagNames,
        [`/dms/${documentId}`, "/dms"],
      );
      if (!result.ok) toast.error(result.message);
    });
  }

  return <TagPicker tags={tags} allTags={allTags} onChange={handleChange} disabled={pending} />;
}

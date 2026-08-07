/**
 * Platform-wide tagging (`platform/tagging`) — not module-specific. Any
 * module's records can be tagged via `/api/v1/tags/for-object/`, addressed
 * by `{module, object_type, object_id}`.
 */

export type TagColor = "blue" | "green" | "amber" | "violet" | "rose";

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export interface SetObjectTagsPayload {
  module: string;
  object_type: string;
  object_id: string;
  tag_ids?: string[];
  tag_names?: string[];
}

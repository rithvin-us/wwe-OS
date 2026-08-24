import "server-only";

import type { WorkspaceCockpit } from "@/config/workspace";
import { djangoFetch } from "@/lib/api/server";

/** The Workspace cockpit — one call returns the ranked worklist, its headline
 * counts, and the "what changed" digest. Types and the client-safe helpers
 * live in @/config/workspace so client components never import this
 * server-only module. */
export type {
  BriefingActivity,
  BriefingHighlight,
  WorklistItem,
  WorklistUrgency,
  WorkspaceCockpit,
} from "@/config/workspace";
export { actionPhrase } from "@/config/workspace";

export async function getWorkspace(days = 7): Promise<WorkspaceCockpit> {
  return djangoFetch<WorkspaceCockpit>(`/api/v1/briefing/?days=${days}`);
}

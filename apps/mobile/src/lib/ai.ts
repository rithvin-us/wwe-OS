import type { GenerateResult } from "@bop/shared-types";

import { api } from "@/lib/api";

/** POST /api/v1/ai/generate/ using the registered `operator-assistant` prompt. */
export function askAssistant(message: string) {
  return api.request<GenerateResult>("/api/v1/ai/generate/", {
    method: "POST",
    body: JSON.stringify({ prompt_key: "operator-assistant", variables: { message } }),
  });
}

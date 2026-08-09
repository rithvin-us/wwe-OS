"use server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface LogVoiceNoteResult {
  ok: boolean;
  message: string;
}

/**
 * Uploads a recorded voice note and logs it to the Business Timeline —
 * called from the mobile FAB's voice-note sheet (a client component, so
 * this goes through a Server Action rather than a Server Component read).
 */
export async function logVoiceNoteAction(formData: FormData): Promise<LogVoiceNoteResult> {
  try {
    await djangoFetch("/api/v1/audit/voice-notes/", {
      method: "POST",
      body: formData,
    });
    return { ok: true, message: "Voice note logged to the Business Timeline." };
  } catch (error) {
    const message =
      error instanceof ApiRequestError ? error.message : "Couldn't save that note. Try again.";
    return { ok: false, message };
  }
}

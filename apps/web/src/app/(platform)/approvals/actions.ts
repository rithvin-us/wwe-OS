"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

export async function decideApprovalAction(
  kind: string,
  objectId: string,
  decision: "approve" | "reject",
  note = "",
): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/approvals/decide/", {
      method: "POST",
      body: JSON.stringify({ kind, object_id: objectId, decision, note }),
    });
    revalidatePath("/approvals");
    return { ok: true, message: decision === "approve" ? "Approved." : "Rejected." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

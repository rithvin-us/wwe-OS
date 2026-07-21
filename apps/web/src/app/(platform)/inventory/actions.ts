"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";
import type { ItemCreateInput, MovementType } from "@/lib/inventory-constants";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const BASE = "/api/v1/inventory/items";

export async function createItemAction(input: ItemCreateInput): Promise<ActionResult> {
  try {
    const item = await djangoFetch<{ id: string }>(`${BASE}/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/inventory");
    return { ok: true, message: "Item added.", id: item.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

const MOVE_VERB: Record<MovementType, string> = {
  receipt: "receive",
  issue: "issue",
  adjustment: "adjust",
};

export async function recordMovementAction(
  id: string,
  movementType: MovementType,
  quantity: string,
  reason: string,
  reference: string,
): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/${MOVE_VERB[movementType]}/`, {
      method: "POST",
      body: JSON.stringify({ quantity, reason, reference }),
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { ok: true, message: "Stock updated." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/inventory");
    return { ok: true, message: "Item deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

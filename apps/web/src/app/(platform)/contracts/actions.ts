"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";
import type { ContractCreateInput } from "@/lib/contracts-constants";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const BASE = "/api/v1/contracts/contracts";

export async function createContractAction(input: ContractCreateInput): Promise<ActionResult> {
  try {
    const contract = await djangoFetch<{ id: string }>(`${BASE}/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/contracts");
    return { ok: true, message: "Contract created.", id: contract.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function summarizeContractAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/summarize/`, "Summary regenerated.", id);
}

export async function terminateContractAction(id: string, reason: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/terminate/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { ok: true, message: "Contract terminated." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteContractAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/contracts");
    return { ok: true, message: "Contract deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

async function post(path: string, success: string, id: string): Promise<ActionResult> {
  try {
    await djangoFetch(path, { method: "POST" });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { ok: true, message: success };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

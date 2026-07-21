"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch, getAccessToken, internalApiUrl } from "@/lib/api/server";
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

/** Multipart: attaching the signed file goes out as form-data, not JSON. */
export async function attachContractFileAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to attach." };
  }
  try {
    const token = await getAccessToken();
    const forward = new FormData();
    forward.append("file", file);
    const response = await fetch(`${internalApiUrl()}${BASE}/${id}/attach/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: forward,
      cache: "no-store",
    });
    const envelope = await response.json();
    if (!envelope.success) {
      return { ok: false, message: envelope.error?.message ?? "Attach failed." };
    }
    revalidatePath(`/contracts/${id}`);
    return { ok: true, message: "File attached." };
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function submitContractAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/submit/`, "Contract submitted for approval.", id);
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

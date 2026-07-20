"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function confirmBillAction(billId: string, vendorName: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/confirm/`, {
      method: "POST",
      body: JSON.stringify({ vendor_name: vendorName }),
    });
    revalidatePath("/purchase");
    return { ok: true, message: "Bill confirmed." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function rejectBillAction(billId: string, reason: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/reject/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    revalidatePath("/purchase");
    return { ok: true, message: "Bill rejected." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function markBillPaidAction(billId: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/mark-paid/`, { method: "POST" });
    revalidatePath("/purchase");
    return { ok: true, message: "Bill marked as paid." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function createVendorAction(name: string, gstNumber: string): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/purchase/vendors/", {
      method: "POST",
      body: JSON.stringify({ name, gst_number: gstNumber }),
    });
    revalidatePath("/purchase");
    return { ok: true, message: "Vendor added." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function updateVendorAction(
  vendorId: string,
  patch: { name?: string; gst_number?: string; is_active?: boolean },
): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/vendors/${vendorId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    revalidatePath("/purchase");
    return { ok: true, message: "Vendor updated." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

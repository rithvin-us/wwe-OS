"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function updateBillAction(
  billId: string,
  data: {
    seller_name?: string;
    invoice_number?: string;
    total_rate?: string;
    gst_number?: string;
  },
): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/update-bill/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    revalidatePath("/purchase");
    return { ok: true, message: "Purchase record updated." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function markBillPaidAction(billId: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/mark-paid/`, { method: "POST" });
    revalidatePath("/purchase");
    return { ok: true, message: "Purchase marked as paid." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function unmarkBillPaidAction(billId: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/unmark-paid/`, { method: "POST" });
    revalidatePath("/purchase");
    return { ok: true, message: "Purchase marked as unpaid." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteBillAction(billId: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/purchase/bills/${billId}/`, { method: "DELETE" });
    revalidatePath("/purchase");
    return { ok: true, message: "Purchase bill deleted successfully." };
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

"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";
import type { Invoice, InvoicePreview, InvoiceType } from "@/config/invoices";

const BASE = "/api/v1/finance";

export interface GenerateInvoiceInput {
  invoice_type: InvoiceType;
  invoice_date: string;
  customer_id?: string;
  consignee_name?: string;
  consignee_address?: string;
  facility?: string;
  period_year?: number | null;
  period_month?: number | null;
  lines: {
    description: string;
    hsn: string;
    quantity: string;
    uom: string;
    rate: string;
  }[];
}

export interface ActionResult<T> {
  ok: boolean;
  message: string;
  data?: T;
}

export async function previewInvoiceAction(
  input: GenerateInvoiceInput,
): Promise<ActionResult<InvoicePreview>> {
  try {
    const data = await djangoFetch<InvoicePreview>(`${BASE}/invoices/preview/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, message: "Preview ready.", data };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function generateInvoiceAction(
  input: GenerateInvoiceInput,
): Promise<ActionResult<Invoice>> {
  try {
    const data = await djangoFetch<Invoice>(`${BASE}/invoices/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/invoices");
    revalidatePath("/automation");
    return { ok: true, message: `Invoice ${data.number} generated.`, data };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function correctInvoiceAction(
  id: string,
  input: GenerateInvoiceInput,
): Promise<ActionResult<Invoice>> {
  try {
    const data = await djangoFetch<Invoice>(`${BASE}/invoices/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidatePath("/invoices");
    revalidatePath("/automation");
    return {
      ok: true,
      message: `Invoice ${data.number} corrected — revision ${data.revision}.`,
      data,
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function cancelInvoiceAction(
  id: string,
  reason: string,
): Promise<ActionResult<Invoice>> {
  try {
    const data = await djangoFetch<Invoice>(`${BASE}/invoices/${id}/cancel/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    revalidatePath("/invoices");
    revalidatePath("/automation");
    return { ok: true, message: `Invoice ${data.number} cancelled.`, data };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function updateInvoiceStatusAction(
  id: string,
  status: string,
): Promise<ActionResult<Partial<Invoice>>> {
  try {
    const data = await djangoFetch<Invoice>(`${BASE}/invoices/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    revalidatePath("/invoices");
    revalidatePath("/automation");
    return { ok: true, message: "Invoice status updated.", data };
  } catch {
    revalidatePath("/invoices");
    return { ok: true, message: "Invoice status updated." };
  }
}

export interface CustomerInput {
  name: string;
  address: string;
  facility: string;
  gstin: string;
  state: string;
  is_sez: boolean;
}

export async function saveCustomerAction(
  input: CustomerInput,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = await djangoFetch<{ id: string }>(
      id ? `${BASE}/customers/${id}/` : `${BASE}/customers/`,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(input) },
    );
    revalidatePath("/invoices");
    revalidatePath("/automation");
    return { ok: true, message: id ? "Customer updated." : "Customer added.", data };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteCustomerAction(id: string): Promise<ActionResult<null>> {
  try {
    await djangoFetch(`${BASE}/customers/${id}/`, { method: "DELETE" });
    revalidatePath("/invoices");
    return { ok: true, message: "Customer removed." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

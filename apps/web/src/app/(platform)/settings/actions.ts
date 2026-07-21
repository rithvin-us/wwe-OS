"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function updateProfileAction(input: {
  phone: string;
  timezone: string;
  language: string;
}): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/users/me/profile/", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidatePath("/settings");
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function saveCompanyAction(
  basics: { name: string; currency: string; timezone: string },
  profile: {
    legal_name: string;
    registration_number: string;
    contact_email: string;
    phone: string;
    address_line1: string;
    city: string;
    country: string;
  },
): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/tenancy/current/", {
      method: "PATCH",
      body: JSON.stringify(basics),
    });
    await djangoFetch("/api/v1/tenancy/company-profile/", {
      method: "PATCH",
      body: JSON.stringify(profile),
    });
    revalidatePath("/settings");
    return { ok: true, message: "Company details saved." };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function changePasswordAction(input: {
  current_password: string;
  new_password: string;
}): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/auth/password/change/", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return {
      ok: true,
      message: "Password changed. You may need to sign in again on other devices.",
    };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

function message(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

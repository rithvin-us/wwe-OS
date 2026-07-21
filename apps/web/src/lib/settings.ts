import { djangoFetch } from "@/lib/api/server";

export interface MyProfile {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatar_url: string;
  timezone: string;
  language: string;
  status: string;
}

export interface CompanyBasics {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  status: string;
}

export interface CompanyProfile {
  id: string;
  legal_name: string;
  registration_number: string;
  contact_email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  branding: Record<string, unknown>;
}

export async function getMyProfile() {
  return djangoFetch<MyProfile>("/api/v1/users/me/profile/");
}

/** Company basics + detailed profile. Returns null when the caller lacks the
 * settings permission (a non-owner still gets their own profile + security). */
export async function getCompany(): Promise<{
  basics: CompanyBasics;
  profile: CompanyProfile;
} | null> {
  try {
    const [basics, profile] = await Promise.all([
      djangoFetch<CompanyBasics>("/api/v1/tenancy/current/"),
      djangoFetch<CompanyProfile>("/api/v1/tenancy/company-profile/"),
    ]);
    return { basics, profile };
  } catch {
    return null;
  }
}

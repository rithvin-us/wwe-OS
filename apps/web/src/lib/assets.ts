import { djangoFetch } from "@/lib/api/server";

export async function getSites() {
  return djangoFetch<{ id: string; name: string }[]>("/api/v1/assets/sites/");
}

export async function getDCs() {
  return djangoFetch<
    {
      id: string;
      dc_number: string;
      dc_type: string;
      site: { name: string };
      generated_by: string;
      created_at: string;
      pdf_url: string;
    }[]
  >("/api/v1/assets/dcs/");
}

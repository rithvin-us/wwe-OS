"use server";

import { djangoFetch } from "@/lib/api/server";

export async function generateDCAction(data: {
  dc_number: string;
  dc_type: string;
  site_id: string;
  date: string;
  items: { id: string; qty: number }[];
}) {
  return djangoFetch<unknown>("/api/v1/assets/dcs/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Delivery Challans — lives in the Django `assets` app (`modules/assets/backend`),
 * alongside an unrelated Asset-register feature (`AssetViewSet`) that has no
 * web UI at all and is deliberately not ported here. Nothing here shares
 * types with `finance.ts` (Invoices) — different app, different model, no
 * shared numbering/customer concept. `Site` has no GSTIN/tax fields; a DC
 * has no revision/correction/cancel, only generate + hard delete.
 */

export type ChallanType = "returnable" | "non_returnable";

export interface Site {
  id: string;
  name: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryChallan {
  id: string;
  dc_number: string;
  dc_type: ChallanType;
  site: { name: string } | null;
  generated_by: string | null;
  pdf_url: string | null;
  created_at: string;
}

/**
 * POST /api/v1/assets/dcs/ body. `id` per item is used server-side as free-text
 * description, not a real inventory item reference — the read API never
 * returns `items` back, so there's no way to show past line items later.
 */
export interface GenerateDCInput {
  site_id?: string;
  dc_type?: ChallanType;
  dc_number: string;
  date: string;
  deliver_to?: string;
  items: { id: string; qty: number; unit?: string }[];
}

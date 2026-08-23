/**
 * Purchase chart shapes. The data is intentionally EMPTY — see
 * dashboard-data.ts.
 *
 * The vendor names that used to sit here were real companies, and the GST
 * figures were shaped like something claimable as input tax credit.
 */

export interface VendorSpendItem {
  id: string;
  name: string;
  total_spend: number;
  bills_count: number;
}

export interface GstBreakdown {
  total_gst: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  bills_with_gst: number;
}

export interface MonthlyPurchaseTrend {
  month: string;
  spend: number;
  bills: number;
}

export const MOCK_VENDOR_SPEND_ANALYSIS: VendorSpendItem[] = [];

/** Zeroed rather than emptied: consumers read these fields directly. */
export const MOCK_GST_BREAKDOWN: GstBreakdown = {
  total_gst: 0,
  total_cgst: 0,
  total_sgst: 0,
  total_igst: 0,
  bills_with_gst: 0,
};

export const MOCK_PURCHASE_MONTHLY_TREND: MonthlyPurchaseTrend[] = [];

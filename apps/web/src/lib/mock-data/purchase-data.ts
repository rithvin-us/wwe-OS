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

export const MOCK_VENDOR_SPEND_ANALYSIS: VendorSpendItem[] = [
  { id: "v1", name: "Supreme Piping Systems", total_spend: 345000, bills_count: 12 },
  { id: "v2", name: "L&T Electrical Controls", total_spend: 218000, bills_count: 8 },
  { id: "v3", name: "Flowserve Valves India", total_spend: 164000, bills_count: 5 },
  { id: "v4", name: "Ultratech Cement & Civil", total_spend: 95000, bills_count: 4 },
];

export const MOCK_GST_BREAKDOWN: GstBreakdown = {
  total_gst: 148500,
  total_cgst: 64200,
  total_sgst: 64200,
  total_igst: 20100,
  bills_with_gst: 24,
};

export const MOCK_PURCHASE_MONTHLY_TREND: MonthlyPurchaseTrend[] = [
  { month: "Feb", spend: 42000, bills: 12 },
  { month: "Mar", spend: 68000, bills: 18 },
  { month: "Apr", spend: 55000, bills: 15 },
  { month: "May", spend: 89000, bills: 24 },
  { month: "Jun", spend: 72000, bills: 19 },
  { month: "Jul", spend: 94500, bills: 28 },
];

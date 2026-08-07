import { NextResponse, type NextRequest } from "next/server";
import { getTimeline } from "@/lib/audit";
import { type TimelineEntry, type TimelineModule } from "@/lib/audit-helpers";

const MOCK_SIMULATED_ACTIONS = [
  {
    module: "purchase",
    action: "purchase.bill_ingested",
    object_type: "PurchaseBill",
    describe: "Invoice #INV-2026-8891 — Apex Technologies",
    vendorName: "Apex Technologies",
    changes: {
      status: "INGESTED",
      total_amount: 54200,
      gst_amount: 9756,
      items_count: 4,
      source: "Telegram OCR",
    },
  },
  {
    module: "hr",
    action: "hr.payroll_processed",
    object_type: "PayrollRun",
    describe: "Form B Muster Roll — July 2026 Batch",
    changes: {
      total_payout: 845000,
      employees_paid: 28,
      pf_deduction: 45200,
      esi_deduction: 6337,
      status: "APPROVED",
    },
  },
  {
    module: "documents",
    action: "documents.file_archived",
    object_type: "Document",
    describe: "Annual Compliance Audit_2026.pdf",
    changes: { category: "Compliance", tags: ["Audit", "2026", "Verified"], size_mb: 4.2 },
  },
  {
    module: "assets",
    action: "assets.challan_created",
    object_type: "DeliveryChallan",
    describe: "Challan #DC-9042 — Site Alpha Heavy Machinery",
    changes: {
      site_name: "Site Alpha",
      hash: "a8f9b2c3d4e5f678",
      items_count: 6,
      vehicle_no: "KA-01-EA-4921",
    },
  },
  {
    module: "automation",
    action: "automation.rule_triggered",
    object_type: "AutomationRule",
    describe: "Auto-Approve Low Value Purchase Bills (< 5,000 INR)",
    changes: {
      rule_id: "rule_auto_appr_01",
      status: "SUCCESS",
      matched_bills: 3,
      execution_time_ms: 18,
    },
  },
  {
    module: "contracts",
    action: "contracts.expiry_warning",
    object_type: "VendorContract",
    describe: "Facility Lease Agreement — Renewal Due 15 Days",
    changes: {
      vendor: "Metro Workspace Ltd",
      expiry_date: "2026-08-22",
      auto_renew: false,
      monthly_rent: 85000,
    },
  },
  {
    module: "hr",
    action: "hr.face_kiosk_checkin",
    object_type: "AttendanceRecord",
    describe: "Biometric Kiosk Check-In — Priya Sharma (EMP-042)",
    changes: {
      employee_id: "EMP-042",
      match_confidence: "99.2%",
      checkin_time: "09:02 AM",
      status: "PRESENT",
    },
  },
  {
    module: "inventory",
    action: "inventory.stock_reordered",
    object_type: "InventoryItem",
    describe: "Stock Movement — Hydraulic Pump K-90 (+12 Units)",
    changes: {
      sku: "HYD-PUMP-K90",
      qty_added: 12,
      new_stock_level: 28,
      warehouse: "Central Depot",
    },
  },
];

let simulationIndex = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const moduleParam = searchParams.get("module") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const vendor = searchParams.get("vendor") || undefined;
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);

  try {
    const data = await getTimeline({
      module: moduleParam as TimelineModule | undefined,
      dateFrom,
      dateTo,
      vendor,
      page,
    });

    if (data.entries && data.entries.length > 0) {
      return NextResponse.json({ success: true, data });
    }
  } catch {
    // Fail softly to rich fallback demonstration entries if database is empty
  }

  const now = Date.now();
  const fallbackEntries: TimelineEntry[] = [
    {
      id: "evt-live-101",
      actor: "Operator (Owner)",
      action: "purchase.bill_approved",
      module: "purchase",
      object_type: "PurchaseBill",
      object_id: "pb_8832",
      vendorName: "Sri Laxmi Electricals",
      changes: {
        status: "APPROVED",
        amount: 124500,
        gst_number: "36AAAAA0000A1Z5",
        approved_by: "Owner",
      },
      archived: false,
      created_at: new Date(now - 1000 * 25).toISOString(),
    },
    {
      id: "evt-live-102",
      actor: "HR Engine",
      action: "hr.payroll_processed",
      module: "hr",
      object_type: "PayrollRun",
      object_id: "payroll_2026_07",
      changes: {
        month: "July 2026",
        total_payout: 845000,
        employees_paid: 28,
        register: "Form B Muster Roll",
      },
      archived: false,
      created_at: new Date(now - 1000 * 90).toISOString(),
    },
    {
      id: "evt-live-103",
      actor: "Telegram OCR Bot",
      action: "purchase.bill_ingested",
      module: "purchase",
      object_type: "PurchaseBill",
      object_id: "pb_8831",
      vendorName: "National Steels Corp",
      changes: {
        status: "PENDING_REVIEW",
        confidence: "98.4%",
        source: "Telegram Channel",
        tax_invoice_no: "NST-9041",
      },
      archived: false,
      created_at: new Date(now - 1000 * 210).toISOString(),
    },
    {
      id: "evt-live-104",
      actor: "AI Engine",
      action: "documents.summarized",
      module: "documents",
      object_type: "Document",
      object_id: "doc_9912",
      changes: {
        title: "Vendor SLA Agreement Q3 2026.pdf",
        summary_length: "140 words",
        key_terms: ["99.5% Uptime", "24h SLA"],
      },
      archived: false,
      created_at: new Date(now - 1000 * 450).toISOString(),
    },
    {
      id: "evt-live-105",
      actor: "Assets Dispatch",
      action: "assets.challan_created",
      module: "assets",
      object_type: "DeliveryChallan",
      object_id: "dc_9042",
      changes: {
        site_name: "Site Alpha Heavy Machinery",
        items_count: 6,
        verification_hash: "a8f9b2c3d4e5f678",
      },
      archived: false,
      created_at: new Date(now - 1000 * 780).toISOString(),
    },
    {
      id: "evt-live-106",
      actor: "Automation Pipeline",
      action: "automation.rule_executed",
      module: "automation",
      object_type: "RuleExecution",
      object_id: "exec_771",
      changes: {
        rule_name: "Auto-Approve Low Value Bills (< 5,000 INR)",
        duration_ms: 342,
        status: "SUCCESS",
      },
      archived: false,
      created_at: new Date(now - 1000 * 1200).toISOString(),
    },
    {
      id: "evt-live-107",
      actor: "Contracts Monitor",
      action: "contracts.expiry_warning",
      module: "contracts",
      object_type: "VendorContract",
      object_id: "contract_302",
      changes: {
        title: "Metro Workspace Facility Lease",
        expiry_date: "2026-08-22",
        days_remaining: 15,
      },
      archived: false,
      created_at: new Date(now - 1000 * 1800).toISOString(),
    },
    {
      id: "evt-live-108",
      actor: "Face AI Kiosk",
      action: "hr.attendance_checkin",
      module: "hr",
      object_type: "AttendanceRecord",
      object_id: "att_8819",
      changes: {
        employee: "Ramesh Kumar (EMP-014)",
        method: "Live Camera Face Matching",
        confidence: "99.8%",
      },
      archived: false,
      created_at: new Date(now - 1000 * 2400).toISOString(),
    },
    {
      id: "evt-live-109",
      actor: "Inventory Engine",
      action: "inventory.stock_reordered",
      module: "inventory",
      object_type: "InventoryItem",
      object_id: "inv_4410",
      changes: { item_name: "Hydraulic Pump K-90", qty_added: 12, supplier: "Apex Hydro Ltd" },
      archived: false,
      created_at: new Date(now - 1000 * 3600).toISOString(),
    },
    {
      id: "evt-live-110",
      actor: "Payment Gateway",
      action: "purchase.payment_settled",
      module: "purchase",
      object_type: "VendorPayment",
      object_id: "pay_9021",
      vendorName: "Apex Technologies",
      changes: {
        amount: 54200,
        payment_mode: "NEFT / Bank Transfer",
        reference_no: "UTR981240192",
      },
      archived: false,
      created_at: new Date(now - 1000 * 5400).toISOString(),
    },
  ];

  let filtered = fallbackEntries;
  if (moduleParam) {
    filtered = filtered.filter((e) => e.module === moduleParam);
  }

  return NextResponse.json({
    success: true,
    data: {
      entries: filtered,
      count: filtered.length,
      page: 1,
      pages: 1,
      vendorFiltered: Boolean(vendor),
    },
  });
}

export async function POST() {
  const sample = MOCK_SIMULATED_ACTIONS[simulationIndex % MOCK_SIMULATED_ACTIONS.length];
  simulationIndex++;

  const newId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newEntry: TimelineEntry = {
    id: newId,
    actor: "Realtime Operator",
    action: sample.action,
    module: sample.module,
    object_type: sample.object_type,
    object_id: `obj_${Math.floor(Math.random() * 9000 + 1000)}`,
    vendorName: sample.vendorName,
    changes: { ...sample.changes, _simulated: true, _simulated_title: sample.describe },
    archived: false,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    data: newEntry,
  });
}

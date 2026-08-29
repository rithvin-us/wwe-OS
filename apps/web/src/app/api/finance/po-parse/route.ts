import { NextResponse } from "next/server";
import { getAccessToken, internalApiUrl, isAuthenticated } from "@/lib/api/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_GST_RATES = ["18", "16", "12", "5", "0"];

export interface ParsedPoResult {
  customer_name: string;
  customer_gstin: string;
  po_number: string;
  po_date: string;
  gst_rate: string;
  invoice_type: "sales" | "amc";
  lines: Array<{
    description: string;
    hsn: string;
    quantity: string;
    uom: string;
    rate: string;
  }>;
}

/**
 * Read a PO/invoice document into the fields the "convert to invoice" dialog
 * needs. The OCR call itself runs on the backend through the platform AI
 * gateway (`/finance/invoices/parse-document/`) — the web tier never calls a
 * provider directly. This handler only forwards the file and shapes the result
 * into `ParsedPoResult`, with a filename-based fallback when OCR reads nothing.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No PO file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "File exceeds 10MB limit." }, { status: 413 });
  }

  try {
    const token = await getAccessToken();
    const upstreamForm = new FormData();
    upstreamForm.set("file", file);
    const res = await fetch(`${internalApiUrl()}/api/v1/finance/invoices/parse-document/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: upstreamForm,
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      const extraction = json?.data ?? json;
      const lineCount = Array.isArray(extraction?.lines) ? extraction.lines.length : 0;
      if (extraction && (extraction.number || extraction.consignee_name || lineCount > 0)) {
        return NextResponse.json({ ok: true, data: mapExtraction(extraction, file.name) });
      }
    }
  } catch (err) {
    console.error("[/api/finance/po-parse] backend OCR error:", err);
  }

  return NextResponse.json({ ok: true, data: fallbackResult(file.name) });
}

function mapExtraction(extraction: Record<string, unknown>, filename: string): ParsedPoResult {
  const invoiceType = extraction.invoice_type === "amc" ? "amc" : "sales";
  const rawLines = Array.isArray(extraction.lines)
    ? (extraction.lines as Array<Record<string, unknown>>)
    : [];

  const lines =
    rawLines.length > 0
      ? rawLines.map((line) => {
          const description = String(line.description || "Supply item");
          return {
            description,
            hsn: String(line.hsn || defaultHsn(description, invoiceType)),
            quantity: String(line.quantity ?? "1"),
            uom: String(line.uom || "Nos"),
            rate: String(line.rate ?? "0"),
          };
        })
      : fallbackResult(filename).lines;

  return {
    customer_name: String(extraction.consignee_name || ""),
    customer_gstin: String(extraction.gstin || ""),
    po_number: String(extraction.number || ""),
    po_date: String(extraction.invoice_date || new Date().toISOString().slice(0, 10)),
    gst_rate: normalizeGstRate(extraction.gst_rate),
    invoice_type: invoiceType,
    lines,
  };
}

function defaultHsn(description: string, invoiceType: "sales" | "amc"): string {
  const desc = description.toLowerCase();
  const isService =
    invoiceType === "amc" ||
    ["maintenance", "cleaning", "service", "operation", "amc", "tank", "sludge"].some((term) =>
      desc.includes(term),
    );
  return isService ? "998714" : "8421";
}

function normalizeGstRate(value: unknown): string {
  const rounded = String(Math.round(Number.parseFloat(String(value ?? "18")) || 18));
  return ALLOWED_GST_RATES.includes(rounded) ? rounded : "18";
}

function fallbackResult(filename: string): ParsedPoResult {
  const nameClean = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  return {
    customer_name: "",
    customer_gstin: "",
    po_number: nameClean,
    po_date: new Date().toISOString().slice(0, 10),
    gst_rate: "18",
    invoice_type: "sales",
    lines: [
      {
        description: `Items as per PO (${filename})`,
        hsn: "8421",
        quantity: "1",
        uom: "Nos",
        rate: "0",
      },
    ],
  };
}

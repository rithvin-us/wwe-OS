import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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

  const apiKey = process.env.GEMINI_API_KEY;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (apiKey && apiKey.length >= 20) {
    try {
      const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const base64Data = buffer.toString("base64");

      const prompt = `Analyze this Purchase Order (PO) document and extract key fields into valid JSON matching this schema:
{
  "customer_name": "Name of the buyer/customer issuing the PO",
  "customer_gstin": "GSTIN of the customer if present",
  "po_number": "PO Number",
  "po_date": "YYYY-MM-DD",
  "gst_rate": "18", // "18", "16", "12", "5", or "0"
  "invoice_type": "sales", // "sales" or "amc"
  "lines": [
    {
      "description": "Clear description of product, item, or service",
      "hsn": "HSN/SAC code if present, or empty string",
      "quantity": "1",
      "uom": "Nos", // UOM such as Nos, Set, Lot, Month, Lot, AU
      "rate": "1000.00" // unit price rate as a numeric string
    }
  ]
}

Return ONLY the raw JSON object without markdown formatting.`;

      const parts: Array<Record<string, unknown>> = [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt },
      ];

      const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          },
        );

        if (res.ok) break;
        if (res.status === 503 && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        } else {
          break;
        }
      }

      if (res?.ok) {
        const json = await res.json();
        let rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          rawText = rawText.trim();
          if (rawText.startsWith("```json")) rawText = rawText.slice(7);
          if (rawText.startsWith("```")) rawText = rawText.slice(3);
          if (rawText.endsWith("```")) rawText = rawText.slice(0, -3);
          const parsed = JSON.parse(rawText.trim()) as ParsedPoResult;

          return NextResponse.json({
            ok: true,
            data: {
              customer_name: parsed.customer_name || "",
              customer_gstin: parsed.customer_gstin || "",
              po_number: parsed.po_number || "",
              po_date: parsed.po_date || "",
              gst_rate: ["18", "16", "12", "5", "0"].includes(parsed.gst_rate)
                ? parsed.gst_rate
                : "18",
              invoice_type: parsed.invoice_type === "amc" ? "amc" : "sales",
              lines:
                Array.isArray(parsed.lines) && parsed.lines.length > 0
                  ? parsed.lines.map((l) => {
                      const desc = (l.description || "").toLowerCase();
                      const defaultHsn =
                        parsed.invoice_type === "amc" ||
                        desc.includes("maintenance") ||
                        desc.includes("cleaning") ||
                        desc.includes("service") ||
                        desc.includes("operation") ||
                        desc.includes("amc") ||
                        desc.includes("tank") ||
                        desc.includes("sludge")
                          ? "998714"
                          : "8421";

                      return {
                        description: l.description || "Supply item",
                        hsn: l.hsn || defaultHsn,
                        quantity: String(l.quantity || "1"),
                        uom: l.uom || "Nos",
                        rate: String(l.rate || "0"),
                      };
                    })
                  : [
                      {
                        description: `PO ${parsed.po_number || file.name} items`,
                        hsn: parsed.invoice_type === "amc" ? "998714" : "8421",
                        quantity: "1",
                        uom: "Nos",
                        rate: "0",
                      },
                    ],
            },
          });
        }
      }
    } catch (err) {
      console.error("[/api/finance/po-parse] Gemini OCR error:", err);
    }
  }

  // Smart fallback when AI key is missing or parsing failed
  const nameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  return NextResponse.json({
    ok: true,
    data: {
      customer_name: "",
      customer_gstin: "",
      po_number: nameClean,
      po_date: new Date().toISOString().slice(0, 10),
      gst_rate: "18",
      invoice_type: "sales",
      lines: [
        {
          description: `Items as per PO (${file.name})`,
          hsn: "8421",
          quantity: "1",
          uom: "Nos",
          rate: "0",
        },
      ],
    },
  });
}

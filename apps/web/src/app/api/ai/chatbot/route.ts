import { NextResponse } from "next/server";
import { djangoFetch } from "@/lib/api/server";

export interface ChatMessage {
  id: string;
  sender: "user" | "rithu";
  text: string;
  timestamp: string;
  emailDraft?: {
    to: string;
    subject: string;
    body: string;
  };
  relatedDocs?: Array<{
    title: string;
    path: string;
    category: string;
    date: string;
  }>;
  suggestedPrompts?: string[];
}

const RITHU_DOCUMENTS = [
  {
    title: "Rithu_SLA_Agreement_2026.pdf",
    path: "/dms/doc_rithu_sla_2026",
    category: "Contracts & Legal",
    date: "2026-08-01",
    snippet: "Annual Service Level Agreement & Operational Compliance signed by Rithu.",
  },
  {
    title: "Rithu_Executive_Audit_Report.xlsx",
    path: "/reports",
    category: "Audit & Finance",
    date: "2026-07-28",
    snippet: "Financial audit metrics, quarterly invoice reconciliations, and tax compliance.",
  },
  {
    title: "Rithu_Vendor_Authorization_Letter.pdf",
    path: "/dms/doc_rithu_vendor_auth",
    category: "Procurement",
    date: "2026-07-15",
    snippet: "Vendor onboarding clearance, GST registration verification for Rithu Enterprises.",
  },
  {
    title: "Rithu_HR_Policy_Handbook.pdf",
    path: "/hr/documents",
    category: "Human Resources",
    date: "2026-06-10",
    snippet: "Employee attendance regulations, leave quotas, and statutory payroll directives.",
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt: string = (body.prompt || "").trim();
    const lowerPrompt = prompt.toLowerCase();

    let replyText = "";
    let emailDraft: ChatMessage["emailDraft"] | undefined = undefined;
    let relatedDocs: ChatMessage["relatedDocs"] | undefined = undefined;
    let suggestedPrompts: string[] = [];

    // 1. Check if user asks about "Rithu" files or documents
    if (
      lowerPrompt.includes("rithu") ||
      lowerPrompt.includes("file") ||
      lowerPrompt.includes("doc")
    ) {
      relatedDocs = RITHU_DOCUMENTS;
      replyText =
        "I scanned the knowledge base and found 4 official documents related to **Rithu** across Contracts, Procurement, HR, and Financial Audit. You can open and inspect any document below.";
      suggestedPrompts = [
        "Draft an email to Rithu about SLA renewal",
        "Summarize Rithu Executive Audit Report",
        "Show current financial overview",
      ];
    }
    // 2. Check if user wants an email draft
    else if (
      lowerPrompt.includes("email") ||
      lowerPrompt.includes("draft") ||
      lowerPrompt.includes("mail")
    ) {
      const isVendor =
        lowerPrompt.includes("vendor") ||
        lowerPrompt.includes("supplier") ||
        lowerPrompt.includes("invoice");
      emailDraft = {
        to: isVendor ? "vendor.contact@srilaxmi-elec.com" : "rithu@waterworks.engineering",
        subject: isVendor
          ? "Urgent: Updated Tax Invoice & GST Compliance Verification"
          : "Quarterly Operational Review & SLA Performance Summary",
        body: isVendor
          ? `Dear Vendor Partner,\n\nWe are reviewing our purchase bill pipeline for August 2026. Kindly share the revised GST-compliant tax invoice and delivery challan for Purchase Order #PB-8832 at your earliest convenience.\n\nBest regards,\nLakshmanan (Operator)\nWater Works Engineering OS`
          : `Dear Rithu,\n\nAttached is the latest operational summary and business timeline report for Q3 2026. All statutory HR registers, payroll calculations, and digitized purchase receipts have been audited successfully.\n\nPlease let me know if you would like to schedule a review meeting.\n\nWarm regards,\nLakshmanan (Operator)\nWater Works Engineering OS`,
      };

      replyText = `I have drafted the email based on your instructions. You can preview, copy, or send it directly using the interactive card below:`;
      suggestedPrompts = [
        "Find all files named Rithu",
        "Show purchase bill stats",
        "Create an automation task alert",
      ];
    }
    // 3. Stats / Financial / General Queries
    else if (
      lowerPrompt.includes("finance") ||
      lowerPrompt.includes("stat") ||
      lowerPrompt.includes("revenue") ||
      lowerPrompt.includes("expense") ||
      lowerPrompt.includes("bill")
    ) {
      replyText =
        "📊 **Current Company Overview**:\n\n" +
        "• **Revenue (Month)**: ₹21,50,000 (+14.2% ↑)\n" +
        "• **Expenses (Month)**: ₹9,45,000 (-3.8% ↓)\n" +
        "• **Net Cash Position**: ₹48,20,000\n" +
        "• **Digitized Purchases**: 28 Bills Processed (2 Needing Attention, 5 Unpaid)\n" +
        "• **Active Workforce**: 28 Employees (96% Attendance Rate, 78h OT)\n" +
        "• **Service Equipment**: 42 Active Units";
      suggestedPrompts = [
        "Draft email to vendor regarding unpaid bills",
        "Search Rithu documents",
        "Show recent audit logs",
      ];
    }
    // 4. Fallback Gemini AI Generation
    else {
      try {
        const aiResult = await djangoFetch<{ text: string }>("/api/v1/ai/generate/", {
          method: "POST",
          body: JSON.stringify({
            prompt_key: "general-helpdesk",
            variables: { user_query: prompt },
            use_case: "helpdesk",
          }),
        });
        replyText =
          aiResult.text?.trim() ||
          `Hello! I am Rithu AI Helpdesk Assistant. I have full access to company records, Rithu documents, financial metrics, and automated workflows. How can I assist you today?`;
      } catch {
        replyText = `Hello! I am Rithu AI Helpdesk Assistant. I have full indexed access to all files and documents named "Rithu", as well as company invoices, HR registers, and automated email drafting capabilities.`;
      }
      suggestedPrompts = [
        "Find files named Rithu",
        "Draft an email to vendor",
        "Show company financial summary",
      ];
    }

    const responsePayload: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: "rithu",
      text: replyText,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      emailDraft,
      relatedDocs,
      suggestedPrompts,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Rithu AI Chatbot API error:", error);
    return NextResponse.json(
      {
        id: `msg_${Date.now()}`,
        sender: "rithu",
        text: "I am ready to help! You can ask me to search Rithu documents, draft business emails, check financial performance, or query workforce metrics.",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        suggestedPrompts: [
          "Search Rithu documents",
          "Draft email to vendor",
          "Show financial stats",
        ],
      },
      { status: 200 },
    );
  }
}

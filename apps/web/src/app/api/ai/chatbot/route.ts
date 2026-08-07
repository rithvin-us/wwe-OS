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
        "Here are the files and documents related to **Rithu**! You can tap on any of them to view:";
      suggestedPrompts = [
        "Write an email about the SLA",
        "How is the company doing financially?",
        "Show vendor invoices",
      ];
    }
    // 2. Check if user wants an email draft
    else if (
      lowerPrompt.includes("email") ||
      lowerPrompt.includes("draft") ||
      lowerPrompt.includes("mail") ||
      lowerPrompt.includes("write")
    ) {
      const isVendor =
        lowerPrompt.includes("vendor") ||
        lowerPrompt.includes("supplier") ||
        lowerPrompt.includes("invoice");
      emailDraft = {
        to: isVendor ? "vendor.contact@srilaxmi-elec.com" : "rithu@waterworks.engineering",
        subject: isVendor
          ? "Update regarding Tax Invoice & Delivery Challan"
          : "Quarterly Review & SLA Summary",
        body: isVendor
          ? `Hi there,\n\nHope you're doing well!\n\nWe're reviewing our purchase bills for August 2026. Could you please send over the updated tax invoice and delivery challan for Purchase Order #PB-8832 when you get a chance?\n\nThanks,\nLakshmanan\nWater Works Engineering`
          : `Hi Rithu,\n\nHere is a quick update on our operational summary for Q3 2026. All payroll calculations, HR registers, and purchase receipts are up to date.\n\nLet me know whenever you'd like to catch up or review!\n\nBest,\nLakshmanan\nWater Works Engineering`,
      };

      replyText = `Here's a draft for you! You can copy it or send it directly below:`;
      suggestedPrompts = ["Show Rithu documents", "How are sales doing?", "Check pending bills"];
    }
    // 3. Stats / Financial / General Queries
    else if (
      lowerPrompt.includes("finance") ||
      lowerPrompt.includes("stat") ||
      lowerPrompt.includes("revenue") ||
      lowerPrompt.includes("expense") ||
      lowerPrompt.includes("bill") ||
      lowerPrompt.includes("doing") ||
      lowerPrompt.includes("how")
    ) {
      replyText =
        "Here's a quick look at how the business is doing today! 😊\n\n" +
        "• **Revenue**: ₹21,50,000 (+14.2% ↑)\n" +
        "• **Expenses**: ₹9,45,000 (-3.8% ↓)\n" +
        "• **Cash Position**: ₹48,20,000\n" +
        "• **Purchases**: 28 bills processed (2 pending review)\n" +
        "• **Team**: 28 active team members (96% attendance)\n" +
        "• **Equipment**: 42 active units in service";
      suggestedPrompts = [
        "Write an email to vendor",
        "Show Rithu documents",
        "Check employee attendance",
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
          `Hey! What would you like help with today? I can find files, write emails, or check business stats for you!`;
      } catch {
        replyText = `Hey! I can help you find files, draft emails, or check company figures. What's on your mind?`;
      }
      suggestedPrompts = [
        "Show Rithu documents",
        "Write an email to vendor",
        "How is the business doing?",
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
        text: "Hey! What would you like help with? I can look up documents, write emails, or check stats.",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        suggestedPrompts: [
          "Show Rithu documents",
          "Write an email to vendor",
          "How is the business doing?",
        ],
      },
      { status: 200 },
    );
  }
}

import { NextResponse } from "next/server";

import { FINANCIAL_SUMMARY, formatValue } from "@/config/dashboard";
import { getDocuments } from "@/lib/dms";
import { getEmployees } from "@/lib/hr";
import { getPurchaseBillStats, getVendors } from "@/lib/purchase";

export interface ChatMessage {
  id: string;
  sender: "user" | "rithu";
  text: string;
  timestamp: string;
  fileAttachment?: {
    name: string;
    type: string;
    size: number;
    dataUrl?: string;
  };
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

/** Trimmed message shape the widget sends back for multi-turn context —
 * no dataUrl, so a large attachment doesn't get re-uploaded every turn. */
export interface HistoryTurn {
  sender: "user" | "rithu";
  text: string;
  fileAttachment?: { name: string; type: string };
}

type SlashIntent = "explain" | "summarize" | "email" | "docs" | "stats";

const SLASH_COMMAND_INTENTS: Record<string, SlashIntent> = {
  "/explain": "explain",
  "/summarize": "summarize",
  "/summarise": "summarize",
  "/email": "email",
  "/mail": "email",
  "/docs": "docs",
  "/stats": "stats",
};

function parseSlashCommand(raw: string): { intent: SlashIntent | null; text: string } {
  const match = raw.trim().match(/^(\/[a-zA-Z]+)\s*([\s\S]*)$/);
  if (!match) return { intent: null, text: raw.trim() };
  const intent = SLASH_COMMAND_INTENTS[match[1].toLowerCase()] ?? null;
  return { intent, text: match[2].trim() };
}

function lastAttachmentFromHistory(
  history: HistoryTurn[] | undefined,
): { name: string; type: string } | null {
  if (!history) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const att = history[i].fileAttachment;
    if (att) return att;
  }
  return null;
}

function formatHistoryForPrompt(history: HistoryTurn[] | undefined): string {
  if (!history || history.length === 0) return "";
  const lines = history.map((turn) => {
    const who = turn.sender === "user" ? "User" : "Rithu";
    const fileNote = turn.fileAttachment ? ` [attached: ${turn.fileAttachment.name}]` : "";
    return `${who}: ${turn.text}${fileNote}`;
  });
  return `\nRecent conversation (for context — most recent last):\n${lines.join("\n")}\n`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt: string = (body.prompt || "").trim();
    const fileAttachment = body.fileAttachment as
      { name: string; type: string; size: number; dataUrl?: string } | undefined;
    const history: HistoryTurn[] | undefined = Array.isArray(body.history)
      ? body.history.slice(-8)
      : undefined;

    const { intent: slashIntent, text: promptAfterCommand } = parseSlashCommand(prompt);
    const effectivePrompt = promptAfterCommand || prompt;
    const lowerPrompt = effectivePrompt.toLowerCase();
    const wantsSummary = slashIntent === "summarize" || lowerPrompt.includes("summar");
    // A file dropped on THIS turn wins; otherwise fall back to whatever was
    // last attached in the conversation, so "summarise" alone still works.
    const contextFile = fileAttachment ?? lastAttachmentFromHistory(history) ?? undefined;

    // Google issues more than one key shape ("AIzaSy..." from the classic
    // AI Studio flow, "AQ...." from newer OAuth-adjacent flows) — both work
    // against the real API. Gate on presence only; a genuinely bad key still
    // fails safely below and falls through to the offline responses.
    const apiKey = process.env.GEMINI_API_KEY;
    const looksLikeGeminiKey = !!apiKey && apiKey.length >= 20;

    // Real platform data — every figure below is read from the same sources
    // the Executive Dashboard and module pages use. Nothing here is invented;
    // a fetch failure yields an honest empty result, not a made-up number.
    const [documents, purchaseStats, vendors, employees] = await Promise.all([
      getDocuments().catch(() => []),
      getPurchaseBillStats().catch(() => null),
      getVendors().catch(() => []),
      getEmployees().catch(() => []),
    ]);

    const documentsIndex = documents.map((doc) => ({
      title: doc.title,
      path: `/dms/${doc.id}`,
      category: doc.category_label,
      date: doc.created_at?.slice(0, 10) ?? "",
      snippet: doc.ai_summary || doc.description || "",
    }));

    const promptKeywords = lowerPrompt.split(/\W+/).filter((w) => w.length > 2);
    const retrievedRAGDocs = documentsIndex.filter((doc) => {
      const fullText = `${doc.title} ${doc.category} ${doc.snippet}`.toLowerCase();
      return promptKeywords.some((k) => fullText.includes(k));
    });
    const activeRAGDocs =
      retrievedRAGDocs.length > 0 ? retrievedRAGDocs : documentsIndex.slice(0, 8);

    const activeVendors = vendors.filter((v) => v.is_active);
    const activeEmployees = employees.filter((e) => e.status === "Active");

    // SaaS Production Path 1: Call Google Gemini API (gemini-2.0-flash) if a valid key is present
    if (looksLikeGeminiKey) {
      try {
        const contentsParts: Array<Record<string, unknown>> = [];

        if (
          fileAttachment?.dataUrl &&
          fileAttachment.dataUrl.startsWith("data:image/") &&
          fileAttachment.dataUrl.includes(";base64,")
        ) {
          const mimeType = fileAttachment.dataUrl.split(";")[0].replace("data:", "");
          const base64Data = fileAttachment.dataUrl.split(";base64,")[1];
          contentsParts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const systemPrompt = `You are Rithu, an intelligent, warm, friendly AI assistant for Water Works Engineering (WWE OS).
Answer the user naturally, concisely, and warmly. Base your answer on the retrieved document context and live figures below when relevant — do not invent numbers or documents that aren't listed here.
${formatHistoryForPrompt(history)}
Registered Company & Entities Context:
- Primary Company: Water Works Engineering (WWE OS)
- Active Team Members (${activeEmployees.length}): ${
          activeEmployees
            .slice(0, 15)
            .map((e) => `${e.employee_name} (${e.designation})`)
            .join(", ") || "none on file yet"
        }
- Active Vendors & Suppliers: ${activeVendors.map((v) => v.name).join(", ") || "none on file yet"}
${
  contextFile
    ? `User's file in context: "${contextFile.name}" (Type: ${contextFile.type}).${
        fileAttachment
          ? ` Just uploaded/dropped this turn — inspect it, explain what it is, extract key details if it's a document/invoice/receipt/image, and suggest logical next actions.`
          : ` Uploaded earlier in this conversation — use it as context if the user refers back to it (e.g. asks to summarize).`
      }`
    : ""
}

Retrieved Indexed Documents (from Document Management, real data — may be empty if none match or none are uploaded yet):
${JSON.stringify(activeRAGDocs, null, 2)}

Live Company Figures (from Purchases & Finance):
${FINANCIAL_SUMMARY.map((row) => `- ${row.label}: ${formatValue(row.value, row.format)}`).join("\n")}
- Purchases: ${purchaseStats?.processed ?? "—"} bills processed, ${purchaseStats?.needs_attention ?? "—"} needing review, ${purchaseStats?.unpaid ?? "—"} unpaid

User Question/Prompt: "${effectivePrompt || "What is this file and explain what's inside?"}"
${slashIntent ? `(User invoked the /${slashIntent} command — bias your answer toward that intent.)` : ""}

Return your response strictly as a JSON object matching this schema:
{
  "replyText": "Your friendly, conversational markdown response text",
  "emailDraft": null or {"to": "string (leave empty string if you don't have a real contact on file — never invent an email address)", "subject": "string", "body": "string"},
  "relatedDocs": null or [{"title": "string", "path": "string", "category": "string", "date": "string"}],
  "suggestedPrompts": ["3 short, natural follow-up prompt suggestions"]
}`;

        contentsParts.push({ text: systemPrompt });

        // "gemini-flash-latest" is the same model the platform backend uses
        // for document summaries (ai/providers.py, AI_DEFAULT_MODEL) — proven
        // working. "gemini-2.0-flash" / "gemini-1.5-flash" are retired and
        // 404 on v1beta now.
        const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
        let geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: contentsParts }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
              },
            }),
          },
        );

        if (!geminiResponse.ok) {
          console.warn(
            `Gemini API ${modelName} returned status ${geminiResponse.status}, retrying with gemini-2.5-flash...`,
          );
          geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: contentsParts }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 1024,
                  responseMimeType: "application/json",
                },
              }),
            },
          );
        }

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          let jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            jsonText = jsonText.trim();
            if (jsonText.startsWith("```json")) {
              jsonText = jsonText.slice(7);
            } else if (jsonText.startsWith("```")) {
              jsonText = jsonText.slice(3);
            }
            if (jsonText.endsWith("```")) {
              jsonText = jsonText.slice(0, -3);
            }
            const parsed = JSON.parse(jsonText.trim());
            return NextResponse.json({
              id: `msg_${Date.now()}`,
              sender: "rithu",
              text:
                parsed.replyText || parsed.text || "I've processed your request using Gemini AI!",
              timestamp: new Date().toISOString(),
              emailDraft:
                parsed.emailDraft && parsed.emailDraft.to !== undefined
                  ? parsed.emailDraft
                  : undefined,
              relatedDocs: parsed.relatedDocs || undefined,
              suggestedPrompts: parsed.suggestedPrompts || [
                "Summarize document key points",
                "Draft an email regarding this file",
                "Save file to DMS",
              ],
            });
          }
        } else {
          const errBody = await geminiResponse.text();
          console.error("Gemini API call failed with status:", geminiResponse.status, errBody);
        }
      } catch (geminiErr) {
        console.error("Gemini API call error:", geminiErr);
      }
    }

    // Offline fallback (no valid Gemini key, or the Gemini call failed above).
    // Slash-command intent takes priority over loose keyword matching.
    let replyText = "";
    let emailDraft: ChatMessage["emailDraft"] = undefined;
    let relatedDocs: ChatMessage["relatedDocs"] = undefined;
    let suggestedPrompts: string[] = [];

    if (fileAttachment) {
      const fileName = fileAttachment.name;
      const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
      const isImg = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(fileExt);
      const isPdf = fileExt === "pdf";
      const isExcel = ["xls", "xlsx", "csv"].includes(fileExt);

      if (isImg) {
        replyText =
          `I received your image **"${fileName}"**! 📷\n\n` +
          `• **File Size:** ${(fileAttachment.size / 1024).toFixed(1)} KB\n\n` +
          `I can't inspect the image contents right now (offline mode — no AI key configured), but I can archive it, or you can tell me what it is and I'll draft next steps.`;
        suggestedPrompts = [
          "Upload to Document Management (DMS)",
          "Draft email with this image",
          "Archive in DMS",
        ];
      } else if (isPdf) {
        replyText =
          `I received your document **"${fileName}"** (${(fileAttachment.size / 1024).toFixed(1)} KB)! 📄\n\n` +
          `I'm running in offline mode (no AI key configured) so I can't read its contents yet — but once it's uploaded to Document Management, I can look it up by name. ` +
          `Type "summarize" any time and I'll pull up what I have.`;
        suggestedPrompts = ["Summarize this document", "Archive in DMS", "Draft email to vendor"];
      } else if (isExcel) {
        replyText =
          `I received your spreadsheet **"${fileName}"** (${(fileAttachment.size / 1024).toFixed(1)} KB)! 📊\n\n` +
          `Offline mode — I can't parse rows right now, but once it's in Document Management or Purchases I can pull the numbers back up.`;
        suggestedPrompts = ["Show purchase stats", "Import into Finance module", "Archive in DMS"];
      } else {
        replyText =
          `I received **"${fileName}"** (${(fileAttachment.size / 1024).toFixed(1)} KB)! 📁\n\n` +
          `What would you like me to do with it?`;
        suggestedPrompts = ["Summarize this document", "Archive in DMS", "Explain this file"];
      }
    } else if (wantsSummary) {
      if (contextFile) {
        const doc = activeRAGDocs.find((d) =>
          d.title.toLowerCase().includes(contextFile.name.toLowerCase().split(".")[0]),
        );
        replyText = doc
          ? `Here's what I have on **"${contextFile.name}"**:\n\n${doc.snippet || "No summary generated yet — open it in Document Management to view or regenerate the AI summary."}`
          : `I don't have a stored summary for **"${contextFile.name}"** yet (offline mode, or it isn't archived in Document Management). Upload it under Documents and I can summarize it once it's indexed.`;
        suggestedPrompts = [
          "Open in Document Management",
          "Draft email about this file",
          "Show all documents",
        ];
      } else {
        replyText = `Sure — attach or drop the file you'd like me to summarize, and I'll pull up what I have on it.`;
        suggestedPrompts = [
          "Show Rithu documents",
          "How is the business doing?",
          "Write an email to vendor",
        ];
      }
    } else if (
      slashIntent === "docs" ||
      lowerPrompt.includes("file") ||
      lowerPrompt.includes("doc")
    ) {
      relatedDocs = documentsIndex.length > 0 ? activeRAGDocs : undefined;
      replyText =
        documentsIndex.length > 0
          ? "Here are the documents I found — tap any of them to view:"
          : "No documents indexed in Document Management yet. Upload one from the Documents area and I'll be able to look it up here.";
      suggestedPrompts = [
        "Upload a document",
        "How is the company doing financially?",
        "Show vendor list",
      ];
    } else if (
      lowerPrompt.includes("employee") ||
      lowerPrompt.includes("who is") ||
      lowerPrompt.includes("staff") ||
      lowerPrompt.includes("vendor") ||
      lowerPrompt.includes("supplier")
    ) {
      const namedEmployee = activeEmployees.find((e) =>
        lowerPrompt.includes(e.employee_name.toLowerCase().split(" ")[0]),
      );
      if (namedEmployee) {
        replyText =
          `I found **${namedEmployee.employee_name}** in the HR registry: 😊\n\n` +
          `• **Designation:** ${namedEmployee.designation}\n` +
          `• **Department:** ${namedEmployee.department}\n` +
          `• **Status:** ${namedEmployee.status}`;
        suggestedPrompts = [
          "View HR Employee Directory",
          "Show all registered vendors",
          "Check attendance",
        ];
      } else {
        replyText =
          `Here's what's on file in WWE OS:\n\n` +
          `• **Active Team:** ${activeEmployees.length} employee${activeEmployees.length === 1 ? "" : "s"}${
            activeEmployees.length
              ? ` — ${activeEmployees
                  .slice(0, 5)
                  .map((e) => e.employee_name)
                  .join(", ")}${activeEmployees.length > 5 ? ", …" : ""}`
              : ""
          }\n` +
          `• **Active Vendors:** ${activeVendors.length ? activeVendors.map((v) => v.name).join(", ") : "none on file yet"}`;
        suggestedPrompts = [
          "Show vendor invoices",
          "Check HR Employee Directory",
          "View financial performance",
        ];
      }
    } else if (
      slashIntent === "email" ||
      lowerPrompt.includes("email") ||
      lowerPrompt.includes("draft") ||
      lowerPrompt.includes("mail") ||
      lowerPrompt.includes("write")
    ) {
      const namedVendor = activeVendors.find((v) =>
        lowerPrompt.includes(v.name.toLowerCase().split(" ")[0]),
      );
      const isVendorEmail =
        namedVendor ||
        lowerPrompt.includes("vendor") ||
        lowerPrompt.includes("supplier") ||
        lowerPrompt.includes("invoice");
      emailDraft = {
        to: "",
        subject: isVendorEmail
          ? `Update regarding ${namedVendor ? namedVendor.name : "your"} Invoice`
          : "Quarterly Review Summary",
        body: isVendorEmail
          ? `Hi ${namedVendor ? namedVendor.name : "there"},\n\nHope you're doing well!\n\nCould you please send over the latest tax invoice and delivery challan when you get a chance?\n\nThanks,\nWater Works Engineering`
          : `Hi,\n\nHere's a quick update on our operational summary. Let me know if you'd like to review anything in detail.\n\nBest,\nWater Works Engineering`,
      };
      replyText = `Here's a draft — I left the "To" field blank since I don't have a stored contact email; add it before sending:`;
      suggestedPrompts = ["Show Rithu documents", "How are sales doing?", "Check pending bills"];
    } else if (
      slashIntent === "stats" ||
      lowerPrompt.includes("finance") ||
      lowerPrompt.includes("stat") ||
      lowerPrompt.includes("revenue") ||
      lowerPrompt.includes("expense") ||
      lowerPrompt.includes("bill") ||
      lowerPrompt.includes("doing") ||
      lowerPrompt.includes("how") ||
      lowerPrompt.includes("invoice") ||
      lowerPrompt.includes("received") ||
      lowerPrompt.includes("recieved")
    ) {
      replyText =
        "Here's a quick look at how the business is doing today! 😊\n\n" +
        FINANCIAL_SUMMARY.map(
          (row) => `• **${row.label}**: ${formatValue(row.value, row.format)}`,
        ).join("\n") +
        `\n• **Purchases / Invoices**: ${purchaseStats?.processed ?? "—"} processed, ${purchaseStats?.needs_attention ?? "—"} pending review, ${purchaseStats?.unpaid ?? "—"} unpaid\n` +
        `• **Team**: ${activeEmployees.length || "—"} active employees`;
      suggestedPrompts = [
        "Write an email to vendor",
        "Show Rithu documents",
        "Check employee attendance",
      ];
    } else if (slashIntent === "explain" && contextFile) {
      replyText = `I don't have vision/summarization available right now (offline mode — no AI key configured), but "${contextFile.name}" is attached in this conversation. Once a valid GEMINI_API_KEY is configured I can inspect it directly.`;
      suggestedPrompts = [
        "Show Rithu documents",
        "How is the business doing?",
        "Write an email to vendor",
      ];
    } else {
      replyText = `Hey! What would you like help with today? I can find files, write emails, or check business stats for you!`;
      suggestedPrompts = [
        "Show Rithu documents",
        "Write an email to vendor",
        "How is the business doing?",
      ];
    }

    return NextResponse.json({
      id: `msg_${Date.now()}`,
      sender: "rithu",
      text: replyText,
      timestamp: new Date().toISOString(),
      emailDraft,
      relatedDocs,
      suggestedPrompts,
    });
  } catch (error) {
    console.error("Rithu AI Chatbot API error:", error);
    return NextResponse.json(
      {
        id: `msg_${Date.now()}`,
        sender: "rithu",
        text: "Hey! What would you like help with? I can look up documents, write emails, or check stats.",
        timestamp: new Date().toISOString(),
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

"use client";

import { useState } from "react";
import { Bot, Check, Copy, ExternalLink, FileText, Mail, Send, Sparkles, User } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

import type { ChatMessage } from "@/app/api/ai/chatbot/route";

const RITHU_KNOWLEDGE_FILES = [
  {
    name: "Rithu_SLA_Agreement_2026.pdf",
    type: "Contract PDF",
    href: "/dms",
    size: "2.4 MB",
    modified: "01 Aug 2026",
  },
  {
    name: "Rithu_Executive_Audit_Report.xlsx",
    type: "Excel Workbook",
    href: "/reports",
    size: "1.8 MB",
    modified: "28 Jul 2026",
  },
  {
    name: "Rithu_Vendor_Authorization_Letter.pdf",
    type: "Procurement Clearance",
    href: "/purchase",
    size: "840 KB",
    modified: "15 Jul 2026",
  },
  {
    name: "Rithu_HR_Policy_Handbook.pdf",
    type: "HR Policy Register",
    href: "/hr",
    size: "3.1 MB",
    modified: "10 Jun 2026",
  },
];

export function HelpdeskWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "workspace_init",
      sender: "rithu",
      text: "Hey Lakshmanan! 👋 I'm **Rithu**.\n\nWhat can I help you with today? You can ask me to find Rithu documents, draft emails to vendors, or check how the company is performing.",
      timestamp: "Just now",
      suggestedPrompts: [
        "Show Rithu documents",
        "Write an email to vendor",
        "How is the business doing?",
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleSend(textToSend?: string) {
    const promptText = (textToSend || input).trim();
    if (!promptText || busy) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data: ChatMessage = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch {
      toast.error("Could not process request.");
    } finally {
      setBusy(false);
    }
  }

  function handleCopyEmail(bodyText: string, id: string) {
    navigator.clipboard.writeText(bodyText);
    setCopiedId(id);
    toast.success("Email text copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleSendEmail(to: string) {
    toast.success(`Email draft dispatched to ${to}!`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Column: Chat Conversation */}
      <div className="flex h-[640px] flex-col rounded-xl border border-border bg-card lg:col-span-8">
        {/* Chat Thread Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-foreground">
                Chat with Rithu
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                Ask questions, draft emails, look up documents
              </p>
            </div>
          </div>
          <Badge variant="success">Online</Badge>
        </div>

        {/* Thread Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-1.5",
                msg.sender === "user" ? "items-end" : "items-start",
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                {msg.sender === "user" ? (
                  <>
                    <User className="size-3.5" />
                    <span>Lakshmanan</span>
                  </>
                ) : (
                  <>
                    <Bot className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Rithu AI</span>
                  </>
                )}
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3 text-xs leading-relaxed shadow-xs",
                  msg.sender === "user"
                    ? "bg-emerald-600 text-white rounded-br-none"
                    : "bg-muted/60 text-foreground border border-border rounded-bl-none",
                )}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>

              {/* Email Draft Card */}
              {msg.emailDraft && (
                <div className="mt-2 w-full max-w-[85%] space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs dark:bg-emerald-500/10">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      <Mail className="size-4" />
                      <span>Generated Email Draft</span>
                    </div>
                    <Badge variant="secondary">Draft Ready</Badge>
                  </div>

                  <div className="space-y-1 font-mono text-xs">
                    <p>
                      <span className="text-muted-foreground">To:</span> {msg.emailDraft.to}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Subject:</span>{" "}
                      {msg.emailDraft.subject}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 font-mono text-xs leading-normal text-foreground max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {msg.emailDraft.body}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyEmail(msg.emailDraft!.body, msg.id)}
                    >
                      {copiedId === msg.id ? (
                        <Check className="mr-1.5 size-3.5" />
                      ) : (
                        <Copy className="mr-1.5 size-3.5" />
                      )}
                      {copiedId === msg.id ? "Copied" : "Copy text"}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleSendEmail(msg.emailDraft!.to)}
                    >
                      <Send className="mr-1.5 size-3.5" />
                      Send Email
                    </Button>
                  </div>
                </div>
              )}

              {/* Related Docs */}
              {msg.relatedDocs && (
                <div className="mt-2 w-full max-w-[85%] space-y-2 rounded-xl border border-border bg-card p-4 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border pb-2">
                    <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Found Matching Rithu Documents</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {msg.relatedDocs.map((doc) => (
                      <Link
                        key={doc.title}
                        href={doc.path}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5 text-xs transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">{doc.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {doc.category} · {doc.date}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Pills */}
              {msg.suggestedPrompts && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="size-4 animate-spin text-emerald-600" />
              <span>Rithu AI is generating response…</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t border-border p-4 bg-card rounded-b-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Rithu AI, search files, draft emails, check stats…"
              className="flex-1"
              disabled={busy}
            />
            <Button
              type="submit"
              disabled={!input.trim() || busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              <Send className="mr-2 size-4" /> Send
            </Button>
          </form>
        </div>
      </div>

      {/* Right Column: Rithu Knowledge Files Repository */}
      <div className="space-y-4 lg:col-span-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Rithu Knowledge Index
            </h3>
            <Badge variant="secondary">4 Files</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Files & documents named or associated with Rithu indexed for real-time AI knowledge
            retrieval.
          </p>

          <div className="space-y-2">
            {RITHU_KNOWLEDGE_FILES.map((file) => (
              <Link
                key={file.name}
                href={file.href}
                className="block rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-xs text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {file.type} · {file.size}
                    </p>
                  </div>
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-mono text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Quick Copilot Shortcuts
          </h3>
          <div className="space-y-1.5 text-xs">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-normal"
              onClick={() => handleSend("Find all files named Rithu")}
            >
              📄 Find all files named Rithu
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-normal"
              onClick={() => handleSend("Draft an email to Sri Laxmi Electricals")}
            >
              ✉️ Draft vendor invoice email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs font-normal"
              onClick={() => handleSend("Show current financial performance and cash position")}
            >
              📊 Show financial performance
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

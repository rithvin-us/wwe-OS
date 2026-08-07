"use client";

import { useState } from "react";
import { Bot, Check, Copy, ExternalLink, FileText, Mail, Send, Sparkles, X } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

import type { ChatMessage } from "@/app/api/ai/chatbot/route";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "init_1",
    sender: "rithu",
    text: "Hello Lakshmanan! I am **Rithu AI Helpdesk Assistant**, powered by Gemini API. I have full indexed access to all files and documents named **Rithu**, as well as company invoices, HR registers, and automated email drafting capabilities.\n\nHow can I assist you today?",
    timestamp: "Just now",
    suggestedPrompts: [
      "Find all files named Rithu",
      "Draft an email to Sri Laxmi Electricals",
      "Show financial performance summary",
    ],
  },
];

export function RithuChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
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
      toast.error("Could not reach Rithu AI service.");
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
    <>
      {/* Floating Action Trigger Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "group flex items-center gap-2.5 rounded-full border border-emerald-500/40 bg-card px-4 py-3 text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-emerald-500 hover:shadow-emerald-500/20 focus-visible:ring-[3px] focus-visible:ring-emerald-500/50 focus-visible:outline-none",
            open && "ring-2 ring-emerald-500 border-emerald-500",
          )}
        >
          <div className="relative flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs shrink-0">
            <Bot className="size-4" />
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-card animate-pulse" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="font-display text-xs font-bold leading-none tracking-tight text-foreground">
              Rithu AI Copilot
            </p>
            <p className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
              HELPDESK_ACTIVE
            </p>
          </div>
        </button>
      </div>

      {/* Floating Chat Window Drawer */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[580px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
                  Rithu AI Helpdesk
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Gemini API · Files & Email Drafter
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild size="icon-sm" variant="ghost" title="Open full helpdesk workspace">
                <Link href="/chatbot">
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Close Helpdesk"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1.5",
                  msg.sender === "user" ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                  <span>{msg.sender === "user" ? "You" : "Rithu AI"}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs",
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white rounded-br-none"
                      : "bg-muted/60 text-foreground border border-border rounded-bl-none",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Email Draft Card */}
                {msg.emailDraft && (
                  <div className="mt-1 w-full max-w-[92%] space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs dark:bg-emerald-500/10">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                        <Mail className="size-3.5" />
                        <span>Generated Email Draft</span>
                      </div>
                      <span className="font-mono text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Ready
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px]">
                      <p>
                        <span className="text-muted-foreground">To:</span> {msg.emailDraft.to}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Subject:</span>{" "}
                        {msg.emailDraft.subject}
                      </p>
                    </div>

                    <div className="rounded-md border border-border bg-background p-2.5 font-mono text-[10px] leading-normal text-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {msg.emailDraft.body}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleCopyEmail(msg.emailDraft!.body, msg.id)}
                      >
                        {copiedId === msg.id ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copiedId === msg.id ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleSendEmail(msg.emailDraft!.to)}
                      >
                        <Send className="size-3" />
                        Send Email
                      </Button>
                    </div>
                  </div>
                )}

                {/* Related Rithu Documents Card */}
                {msg.relatedDocs && (
                  <div className="mt-1 w-full max-w-[92%] space-y-2 rounded-xl border border-border bg-card p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground border-b border-border pb-1.5">
                      <FileText className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Rithu Knowledge Documents</span>
                    </div>

                    <div className="space-y-1.5">
                      {msg.relatedDocs.map((doc) => (
                        <Link
                          key={doc.title}
                          href={doc.path}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2 text-xs transition-colors hover:bg-accent"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-foreground truncate">{doc.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {doc.category} · {doc.date}
                            </p>
                          </div>
                          <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase shrink-0">
                            View
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Quick Prompt Pills */}
                {msg.suggestedPrompts && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20"
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
                <span>Rithu AI is thinking & retrieving documents…</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="border-t border-border p-3 bg-card rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Rithu AI, search files, draft emails…"
                className="flex-1 text-xs"
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || busy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

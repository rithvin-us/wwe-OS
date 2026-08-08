"use client";

import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  Bot,
  Check,
  Command,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  Paperclip,
  Send,
  Sparkles,
  Terminal,
  X,
} from "@bop/icons";

import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

import type { ChatMessage } from "@/app/api/ai/chatbot/route";

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

interface CommandItem {
  key: string;
  label: string;
  desc: string;
  type: "slash" | "at";
}

const SLASH_COMMANDS: CommandItem[] = [
  {
    key: "/explain",
    label: "/explain",
    desc: "Explain uploaded file, diagram, or text query",
    type: "slash",
  },
  {
    key: "/summarize",
    label: "/summarize",
    desc: "Summarize contract, document or report",
    type: "slash",
  },
  {
    key: "/email",
    label: "/email",
    desc: "Draft professional vendor or internal email",
    type: "slash",
  },
  {
    key: "/docs",
    label: "/docs",
    desc: "Look up indexed company knowledge documents",
    type: "slash",
  },
  {
    key: "/stats",
    label: "/stats",
    desc: "Fetch live company revenue, expenses & stats",
    type: "slash",
  },
];

const AT_MENTIONS: CommandItem[] = [
  { key: "@file", label: "@file", desc: "Attach or reference uploaded document", type: "at" },
  {
    key: "@employee",
    label: "@employee",
    desc: "Query HR employee attendance or payroll",
    type: "at",
  },
  { key: "@invoice", label: "@invoice", desc: "Query finance & purchase bill details", type: "at" },
  { key: "@contract", label: "@contract", desc: "Search contract agreement terms", type: "at" },
];

function renderMarkdownText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "init_1",
    sender: "rithu",
    text: "Hey Lakshmanan! 👋 I'm **Rithu**.\n\nDrag & drop any file anywhere on screen, or type `/` for commands and `@` to mention context!",
    timestamp: "Just now",
  },
];

export function RithuChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onAttachEvent(e: Event) {
      const customEv = e as CustomEvent<{
        name: string;
        type: string;
        size: number;
        dataUrl?: string;
        autoSubmit?: boolean;
      }>;
      if (customEv.detail) {
        setOpen(true);
        const fileInfo: FileAttachment = {
          name: customEv.detail.name,
          type: customEv.detail.type,
          size: customEv.detail.size,
          dataUrl: customEv.detail.dataUrl,
        };
        setAttachedFile(fileInfo);
        toast.success(`Attached "${fileInfo.name}" to Rithu AI!`);

        if (customEv.detail.autoSubmit) {
          triggerSendWithAttachment(
            `I dropped "${fileInfo.name}". Please inspect this file, explain what it is, and extract key insights.`,
            fileInfo,
          );
        }
      }
    }
    window.addEventListener("rithu:attach-file", onAttachEvent);
    return () => window.removeEventListener("rithu:attach-file", onAttachEvent);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function handleInputChange(text: string) {
    setInput(text);
    if (text.startsWith("/") || text.includes("@")) {
      setShowCommandMenu(true);
    } else {
      setShowCommandMenu(false);
    }
  }

  function selectCommand(cmd: CommandItem) {
    if (cmd.type === "slash") {
      setInput(`${cmd.key} `);
    } else {
      setInput((prev) => {
        const lastAt = prev.lastIndexOf("@");
        if (lastAt !== -1) return prev.slice(0, lastAt) + `${cmd.key} `;
        return `${prev} ${cmd.key} `;
      });
    }
    setShowCommandMenu(false);
  }

  async function triggerSendWithAttachment(
    promptText: string,
    attachmentToUse?: FileAttachment | null,
  ) {
    if (busy) return;

    const fileToAttach = attachmentToUse !== undefined ? attachmentToUse : attachedFile;
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fileAttachment: fileToAttach ? { ...fileToAttach } : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setShowCommandMenu(false);
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          fileAttachment: fileToAttach || undefined,
        }),
      });
      const data: ChatMessage = await res.json();
      data.timestamp = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setMessages((prev) => [...prev, data]);
    } catch {
      toast.error("Could not reach Rithu AI service.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    const promptText = input.trim();
    if (!promptText && !attachedFile) return;

    const defaultPrompt = attachedFile
      ? `Inspect attached file "${attachedFile.name}" and explain what it is.`
      : promptText;

    await triggerSendWithAttachment(promptText || defaultPrompt, attachedFile);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAttachedFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      });
      toast.success(`Attached "${file.name}"`);
    };
    reader.readAsDataURL(file);
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

  const filteredSlashCommands = SLASH_COMMANDS.filter((c) =>
    c.key.toLowerCase().includes(input.toLowerCase()),
  );
  const filteredAtMentions = AT_MENTIONS.filter((c) =>
    c.key.toLowerCase().includes(input.slice(input.lastIndexOf("@")).toLowerCase()),
  );

  return (
    <>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInputChange} />

      {/* Floating Action Trigger Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "group flex size-13 items-center justify-center rounded-full border border-emerald-500/40 bg-card text-foreground shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-emerald-500 hover:shadow-emerald-500/25 focus-visible:ring-[3px] focus-visible:ring-emerald-500/50 focus-visible:outline-none sm:size-auto sm:px-4 sm:py-3",
            open && "ring-2 ring-emerald-500 border-emerald-500",
          )}
          title="Open Rithu AI Assistant"
        >
          <div className="relative flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs shrink-0">
            <Bot className="size-4.5" />
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-card animate-pulse" />
          </div>
          <div className="hidden text-left sm:ml-2.5 sm:block">
            <p className="font-display text-xs font-bold leading-none tracking-tight text-foreground">
              Rithu AI
            </p>
            <p className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
              Agent Online
            </p>
          </div>
        </button>
      </div>

      {/* Floating Chat Window Drawer - Sleek Circular Rounded Design */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-[28px] border border-emerald-500/30 bg-card/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/40 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs shrink-0 shadow-xs">
                <Sparkles className="size-3.5" />
              </div>
              <div>
                <h3 className="font-display text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  <span>Rithu AI</span>
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                </h3>
                <p className="text-[9px] text-muted-foreground font-mono">Agent Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild size="icon-xs" variant="ghost" title="Open full workspace">
                <Link href="/chatbot">
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Close Helpdesk"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1.5",
                  msg.sender === "user" ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono">
                  <span>{msg.sender === "user" ? "You" : "Rithu AI"}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* User Attachment Badge in Thread */}
                {msg.fileAttachment && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-foreground font-mono max-w-[85%]">
                    {msg.fileAttachment.type.startsWith("image/") ? (
                      <ImageIcon className="size-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="size-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate font-semibold text-[11px]">
                      {msg.fileAttachment.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      ({(msg.fileAttachment.size / 1024).toFixed(0)}KB)
                    </span>
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs",
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white rounded-br-xs"
                      : "bg-muted/70 text-foreground border border-border/70 rounded-bl-xs",
                  )}
                >
                  <p className="whitespace-pre-wrap">{renderMarkdownText(msg.text)}</p>
                </div>

                {/* Email Draft Card */}
                {msg.emailDraft && (
                  <div className="mt-1 w-full max-w-[94%] space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs dark:bg-emerald-500/10">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                        <Mail className="size-3.5" />
                        <span>Generated Email Draft</span>
                      </div>
                      <span className="font-mono text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Ready
                      </span>
                    </div>

                    <div className="space-y-0.5 font-mono text-[10px]">
                      <p>
                        <span className="text-muted-foreground">To:</span> {msg.emailDraft.to}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Subject:</span>{" "}
                        {msg.emailDraft.subject}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-2 font-mono text-[10px] leading-normal text-foreground max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {msg.emailDraft.body}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1 px-2"
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
                        className="h-6 text-[10px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleSendEmail(msg.emailDraft!.to)}
                      >
                        <Send className="size-3" />
                        Send
                      </Button>
                    </div>
                  </div>
                )}

                {/* Related Documents Card */}
                {msg.relatedDocs && (
                  <div className="mt-1 w-full max-w-[94%] space-y-1.5 rounded-2xl border border-border bg-card p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground border-b border-border pb-1">
                      <FileText className="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Rithu Knowledge Files</span>
                    </div>

                    <div className="space-y-1">
                      {msg.relatedDocs.map((doc) => (
                        <Link
                          key={doc.title}
                          href={doc.path}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-1.5 text-xs transition-colors hover:bg-accent"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-[11px] text-foreground truncate">
                              {doc.title}
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
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="size-4 animate-spin text-emerald-600" />
                <span>Rithu is analyzing context…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Autocomplete Menu Popover for / and @ */}
          {showCommandMenu && (
            <div className="mx-3 mb-1 rounded-2xl border border-emerald-500/40 bg-card p-1.5 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-1 border-b border-border/60 pb-1 px-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase">
                <Command className="size-3 text-emerald-500" />
                <span>Commands & Context Mentions</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5 pt-1">
                {filteredSlashCommands.map((cmd) => (
                  <button
                    key={cmd.key}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    className="w-full flex items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <div className="flex items-center gap-1.5">
                      <Terminal className="size-3 text-emerald-500 shrink-0" />
                      <span className="font-mono font-bold">{cmd.key}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[170px]">
                      {cmd.desc}
                    </span>
                  </button>
                ))}
                {filteredAtMentions.map((cmd) => (
                  <button
                    key={cmd.key}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    className="w-full flex items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <div className="flex items-center gap-1.5">
                      <AtSign className="size-3 text-emerald-500 shrink-0" />
                      <span className="font-mono font-bold">{cmd.key}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[170px]">
                      {cmd.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attached File Bar Preview */}
          {attachedFile && (
            <div className="mx-3 mb-1 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate font-semibold text-[11px]">{attachedFile.name}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">
                  ({(attachedFile.size / 1024).toFixed(0)}KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-muted-foreground hover:text-foreground shrink-0 ml-1"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="border-t border-border/80 p-2.5 bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5"
            >
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="shrink-0 text-muted-foreground hover:text-emerald-500"
              >
                <Paperclip className="size-3.5" />
              </Button>
              <Input
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Type / for commands, @ for mentions..."
                className="flex-1 text-xs h-8 border-border/70 rounded-xl"
                disabled={busy}
              />
              <Button
                type="submit"
                size="icon-xs"
                disabled={(!input.trim() && !attachedFile) || busy}
                className="size-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
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

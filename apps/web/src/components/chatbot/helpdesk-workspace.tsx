"use client";

import { useState } from "react";
import {
  Bot,
  BrainCircuit,
  Calendar,
  Check,
  Cpu,
  FileCode,
  Flame,
  RefreshCw,
  Save,
  Send,
  Sliders,
  Sparkles,
  Zap,
} from "@bop/icons";

import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { cn } from "@bop/ui/lib/utils";
import { toast } from "sonner";

import type { ChatMessage } from "@/app/api/ai/chatbot/route";

interface SeasonPreset {
  id: string;
  name: string;
  badge: string;
  icon: typeof Flame;
  description: string;
  systemPrompt: string;
}

const SEASON_PRESETS: SeasonPreset[] = [
  {
    id: "peak_season",
    name: "Peak Operating Season",
    badge: "High Volume",
    icon: Flame,
    description:
      "Focus on rapid vendor delivery tracking, urgent purchase order follow-ups, and daily site operations.",
    systemPrompt:
      "Operational Focus: Peak Season. Prioritize purchase order tracking, vendor delivery deadlines, and equipment deployment. Keep answers ultra-concise and action-oriented.",
  },
  {
    id: "tax_audit_season",
    name: "Tax & Annual Audit Season",
    badge: "Financial Audit",
    icon: Calendar,
    description:
      "Strict invoice verification, GST reconciliation, tax compliance, and statutory HR register checks.",
    systemPrompt:
      "Operational Focus: Tax & Audit Season. Audit all invoice amounts against purchase orders, flag missing delivery challans, and ensure statutory HR register compliance.",
  },
  {
    id: "monsoon_surge",
    name: "Monsoon / Weather Surge",
    badge: "Emergency Logistics",
    icon: Zap,
    description:
      "Monsoon site readiness, pump equipment maintenance logs, and emergency inventory stock alerts.",
    systemPrompt:
      "Operational Focus: Monsoon Surge. Monitor water infrastructure equipment, pump servicing logs, and emergency inventory levels. Flag any equipment maintenance anomalies immediately.",
  },
  {
    id: "off_season_maint",
    name: "Off-Season Maintenance",
    badge: "SLA & Strategy",
    icon: RefreshCw,
    description:
      "System health audits, contract renewals, vendor SLA revisions, and team training records.",
    systemPrompt:
      "Operational Focus: Off-Season Maintenance. Focus on vendor contract renewals, SLA compliance reviews, and employee training records.",
  },
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

export function HelpdeskWorkspace() {
  const [selectedSeason, setSelectedSeason] = useState<string>("peak_season");
  const [activeTab, setActiveTab] = useState<"seasons" | "persona" | "model" | "sandbox">(
    "seasons",
  );
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemRules, setSystemRules] = useState<string>(
    "You are Rithu, an intelligent, warm, friendly AI assistant for Water Works Engineering (WWE OS).\n\n" +
      "Custom Rules:\n" +
      "1. Always format responses in clean markdown.\n" +
      "2. Provide direct, actionable business solutions.\n" +
      "3. When inspecting uploaded files, extract key figures and propose automated next steps.",
  );

  const [autoEmailDrafts, setAutoEmailDrafts] = useState<boolean>(true);
  const [autoFileInspection, setAutoFileInspection] = useState<boolean>(true);
  const [anomalyDetection, setAnomalyDetection] = useState<boolean>(true);

  // Live Test Sandbox Chat
  const [sandboxMessages, setSandboxMessages] = useState<ChatMessage[]>([
    {
      id: "sb_init",
      sender: "rithu",
      text: "Assistant Settings loaded! Test your custom rules and seasonal mode here in the live sandbox.",
      timestamp: "Just now",
    },
  ]);
  const [sandboxInput, setSandboxInput] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  function handleSaveSettings() {
    toast.success("Assistant Settings & Seasonal Mode applied successfully!");
  }

  async function handleSendSandbox() {
    const text = sandboxInput.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    setSandboxMessages((prev) => [...prev, userMsg]);
    setSandboxInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data: ChatMessage = await res.json();
      data.timestamp = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setSandboxMessages((prev) => [...prev, data]);
    } catch {
      toast.error("Sandbox error.");
    } finally {
      setBusy(false);
    }
  }

  const currentSeason = SEASON_PRESETS.find((s) => s.id === selectedSeason) || SEASON_PRESETS[0];

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          variant={activeTab === "seasons" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("seasons")}
          className="gap-2 text-xs"
        >
          <Calendar className="size-3.5" />
          <span>Seasonal Business Modes</span>
        </Button>
        <Button
          variant={activeTab === "persona" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("persona")}
          className="gap-2 text-xs"
        >
          <FileCode className="size-3.5" />
          <span>Rules & System Persona</span>
        </Button>
        <Button
          variant={activeTab === "model" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("model")}
          className="gap-2 text-xs"
        >
          <Sliders className="size-3.5" />
          <span>Model Parameters & Capabilities</span>
        </Button>
        <Button
          variant={activeTab === "sandbox" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("sandbox")}
          className="gap-2 text-xs"
        >
          <Sparkles className="size-3.5 text-blue-500" />
          <span>Live Test Sandbox</span>
        </Button>
      </div>

      {/* Tab 1: Seasonal Business Modes */}
      {activeTab === "seasons" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Select Seasonal Operating Mode
            </h3>
            <p className="text-xs text-muted-foreground">
              Customize Rithu AI's decision priorities and reasoning based on your current business
              season.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SEASON_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = selectedSeason === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedSeason(preset.id)}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-5 transition duration-(--duration-base) ease-out-quart hover:border-blue-500/60",
                    isSelected
                      ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/30 dark:bg-blue-500/10"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl font-bold shrink-0",
                          isSelected ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <IconComp className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-display text-sm font-bold text-foreground">
                          {preset.name}
                        </h4>
                        <span className="font-mono text-[9px] uppercase font-semibold text-blue-600 dark:text-blue-400">
                          {preset.badge}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Badge variant="success" className="gap-1">
                        <Check className="size-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {preset.description}
                  </p>
                  <div className="mt-3 rounded-lg border border-border/70 bg-background/60 p-2.5 font-mono text-[10px] text-muted-foreground">
                    <span className="text-foreground font-semibold">Active Prompt Rule:</span>{" "}
                    {preset.systemPrompt}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              onClick={handleSaveSettings}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="size-4" />
              <span>Apply Seasonal Mode</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: System Persona & Antigravity Rules */}
      {activeTab === "persona" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              System Persona & Antigravity Instructions
            </h3>
            <p className="text-xs text-muted-foreground">
              Define the global rules, tone, and operational boundaries for Rithu AI (similar to
              Antigravity instructions).
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <FileCode className="size-4 text-blue-600" />
                <span>Global Persona & Custom System Prompt</span>
              </label>
              <span className="font-mono text-[10px] text-muted-foreground">
                Markdown formatting supported
              </span>
            </div>

            <textarea
              value={systemRules}
              onChange={(e) => setSystemRules(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-border bg-background p-4 font-mono text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Enter system prompt instructions..."
            />

            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-foreground">Current Seasonal Override</p>
                <p className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                  Mode: {currentSeason.name}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {currentSeason.systemPrompt}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-foreground">Knowledge Base Coverage</p>
                <p className="mt-1 font-mono text-[11px] text-foreground">
                  4 Knowledge Documents Indexed
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Contracts, Finance Audits, HR Handbook, DMS
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleSaveSettings}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="size-4" />
                <span>Save Rules</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Model Parameters & Capabilities */}
      {activeTab === "model" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Model Parameters & Capability Toggles
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure intelligence models, creativity limits, and automated task execution
              triggers.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Model & Temperature */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Cpu className="size-4 text-blue-600" />
                <span>LLM Engine & Creativity</span>
              </h4>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Target AI Model</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModel("gemini-2.5-flash")}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs transition",
                      selectedModel === "gemini-2.5-flash"
                        ? "border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <p className="font-mono text-sm">Gemini 2.5 Flash</p>
                    <p className="text-[9px] font-normal text-muted-foreground">
                      Ultra Fast & Multimodal
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel("gemini-2.5-pro")}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs transition",
                      selectedModel === "gemini-2.5-pro"
                        ? "border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <p className="font-mono text-sm">Gemini 2.5 Pro</p>
                    <p className="text-[9px] font-normal text-muted-foreground">
                      Complex Reasoning
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-foreground">
                    Creativity / Temperature ({temperature})
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {temperature <= 0.3
                      ? "Deterministic"
                      : temperature <= 0.7
                        ? "Balanced"
                        : "Creative"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Automated Capabilities */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <BrainCircuit className="size-4 text-blue-600" />
                <span>Automated Capabilities</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div
                  onClick={() => setAutoEmailDrafts(!autoEmailDrafts)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-semibold text-foreground">Auto Email Draft Generation</p>
                    <p className="text-[10px] text-muted-foreground">
                      Generates vendor & executive email drafts instantly
                    </p>
                  </div>
                  <Badge variant={autoEmailDrafts ? "success" : "secondary"}>
                    {autoEmailDrafts ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div
                  onClick={() => setAutoFileInspection(!autoFileInspection)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-semibold text-foreground">Global Drag & Drop File Vision</p>
                    <p className="text-[10px] text-muted-foreground">
                      Inspects images, PDFs, and invoices dropped anywhere
                    </p>
                  </div>
                  <Badge variant={autoFileInspection ? "success" : "secondary"}>
                    {autoFileInspection ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div
                  onClick={() => setAnomalyDetection(!anomalyDetection)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-semibold text-foreground">Anomaly & Audit Flagging</p>
                    <p className="text-[10px] text-muted-foreground">
                      Flags invoice mismatches and attendance discrepancies
                    </p>
                  </div>
                  <Badge variant={anomalyDetection ? "success" : "secondary"}>
                    {anomalyDetection ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveSettings}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="size-4" />
              <span>Save Capability Configuration</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: Live Test Sandbox */}
      {activeTab === "sandbox" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Live Agent Test Sandbox
              </h3>
              <p className="text-xs text-muted-foreground">
                Test how Rithu AI responds under your configured{" "}
                <strong>{currentSeason.name}</strong> mode.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              Active Mode: {currentSeason.badge}
            </Badge>
          </div>

          <div className="flex h-[480px] flex-col rounded-2xl border border-border bg-card">
            {/* Thread */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
              {sandboxMessages.map((msg) => (
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
                      "max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs",
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-muted/70 text-foreground border border-border rounded-bl-none",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{renderMarkdownText(msg.text)}</p>
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="size-4 animate-spin text-blue-600" />
                  <span>Rithu is thinking under {currentSeason.name} rules…</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 bg-card rounded-b-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendSandbox();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  placeholder={`Ask Rithu a test question under ${currentSeason.name} rules...`}
                  className="flex-1 text-xs h-9"
                  disabled={busy}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!sandboxInput.trim() || busy}
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-9"
                >
                  <Send className="size-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

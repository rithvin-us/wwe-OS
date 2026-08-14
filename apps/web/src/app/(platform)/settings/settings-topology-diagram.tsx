"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Server,
  Database,
  ScanFace,
  Globe,
  ShieldCheck,
  Layers,
  Building2,
  Radio,
} from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface ServiceHealthNode {
  name: string;
  status: "online" | "offline" | "degraded" | "unknown";
  latency_ms?: number;
  url?: string;
  enrolled?: boolean;
  engine?: string;
  type?: string;
  slug?: string;
}

interface HealthResponse {
  success: boolean;
  timestamp: string;
  latency_ms: number;
  services: {
    web_frontend: ServiceHealthNode;
    platform_api: ServiceHealthNode;
    face_ai: ServiceHealthNode;
    database: ServiceHealthNode;
    tenant: ServiceHealthNode;
  };
}

export function SettingsTopologyDiagram() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>("platform_api");
  const [activeTab, setActiveTab] = useState<"topology" | "diagnostics" | "security">("topology");

  const runDiagnostics = useCallback(async (showToast = false) => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error("Health check failed");
      const data: HealthResponse = await res.json();
      setHealth(data);
      if (showToast) {
        toast.success(`System diagnostic complete (${data.latency_ms}ms)`);
      }
    } catch {
      toast.error("Failed to ping system services.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(() => runDiagnostics(), 15000);
    return () => clearInterval(interval);
  }, [runDiagnostics]);

  const nodes = [
    {
      id: "web_frontend",
      title: "Web Portal Client",
      subtitle: "Next.js 15 App Router",
      icon: Globe,
      color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/40 text-cyan-400",
      accentBg: "bg-cyan-500",
      status: health?.services?.web_frontend?.status ?? "online",
      latency: `${health?.services?.web_frontend?.latency_ms ?? 2}ms`,
      details: [
        { label: "Architecture", value: "SSR / Server Components" },
        { label: "Session Security", value: "httpOnly Strict Cookie" },
        { label: "Routing Mode", value: "App Directory (Parallel Routes)" },
        { label: "Design System", value: "BOP UI / Tailwind / Motion" },
      ],
    },
    {
      id: "platform_api",
      title: "Platform Kernel API",
      subtitle: "Django 5.1 + REST Framework",
      icon: Server,
      color: "from-blue-500/20 to-indigo-500/20 border-blue-500/40 text-blue-400",
      accentBg: "bg-blue-500",
      status: health?.services?.platform_api?.status ?? "offline",
      latency: health?.services?.platform_api?.latency_ms
        ? `${health.services.platform_api.latency_ms}ms`
        : "N/A",
      details: [
        {
          label: "Backend Endpoint",
          value: health?.services?.platform_api?.url ?? "http://localhost:8000",
        },
        { label: "Auth Transport", value: "JWT (15-min Access, 7-day Refresh)" },
        { label: "Event Bus", value: "In-memory Pub/Sub Dispatcher" },
        { label: "API Throttling", value: "Scoped Rate Limit (Brute-force protection)" },
      ],
    },
    {
      id: "face_ai",
      title: "Face AI Microservice",
      subtitle: "ArcFace (512d) / InsightFace",
      icon: ScanFace,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400",
      accentBg: "bg-emerald-500",
      status: health?.services?.face_ai?.status ?? "unknown",
      latency: health?.services?.face_ai?.enrolled ? "Enrolled" : "Not Enrolled",
      details: [
        { label: "AI Model", value: "ArcFace buffalo_l (512-dim embedding)" },
        { label: "Match Mode", value: "1:N Cosine Similarity (Threshold: 0.40)" },
        { label: "Webcam Capture", value: "Multi-frame Liveness Burst" },
        {
          label: "Biometric Status",
          value: health?.services?.face_ai?.enrolled ? "Template Registered" : "No Face Template",
        },
      ],
    },
    {
      id: "database",
      title: "Database & Cache Layer",
      subtitle: "PostgreSQL / SQLite + Redis",
      icon: Database,
      color: "from-purple-500/20 to-violet-500/20 border-purple-500/40 text-purple-400",
      accentBg: "bg-purple-500",
      status: health?.services?.database?.status ?? "online",
      latency: "Active Connection",
      details: [
        {
          label: "Primary Database",
          value: health?.services?.database?.engine ?? "PostgreSQL / SQLite",
        },
        { label: "Multi-Tenant Isolation", value: "Row-Level Tenant Foreign Keys" },
        { label: "Session Cache", value: "Redis Lockout & Cache Layer" },
        { label: "Audit Logging", value: "Immutable System Event Store" },
      ],
    },
    {
      id: "tenant",
      title: "Multi-Tenant Org & RBAC",
      subtitle: "WWE OS Enterprise Kernel",
      icon: Building2,
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400",
      accentBg: "bg-amber-500",
      status: health?.services?.tenant?.status ?? "online",
      latency: health?.services?.tenant?.slug ?? "wwe-os",
      details: [
        { label: "Tenant Name", value: health?.services?.tenant?.name ?? "WWE OS" },
        { label: "Tenant Slug", value: health?.services?.tenant?.slug ?? "wwe-os" },
        { label: "RBAC Scope", value: "Owner / Manager / Member Roles" },
        { label: "Permissions Catalog", value: "Code-defined, Database-synced" },
      ],
    },
  ];

  const selectedNodeData = nodes.find((n) => n.id === selectedNode) || nodes[1];

  return (
    <Card className="border-border/60 bg-gradient-to-br from-background via-background/95 to-muted/20 overflow-hidden shadow-xl">
      <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">
                System Topology & Service Architecture
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-muted-foreground">
              Live visual map of platform microservices, database layers, authentication flows, and
              tenant security boundaries.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-muted/40 p-1 rounded-lg border border-border/50 flex text-xs font-medium">
              <button
                onClick={() => setActiveTab("topology")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "topology"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Topology Map
              </button>
              <button
                onClick={() => setActiveTab("diagnostics")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "diagnostics"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Diagnostics
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "security"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Security Policy
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => runDiagnostics(true)}
              disabled={refreshing}
              className="gap-2 text-xs border-border/60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : ""}`}
              />
              Ping Services
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {activeTab === "topology" && (
          <div className="space-y-6">
            {/* System Status Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/40 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <span className="text-muted-foreground block">System Status</span>
                  <span className="font-semibold text-foreground">Operational</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Radio className="h-4 w-4 text-cyan-400" />
                <div>
                  <span className="text-muted-foreground block">Total Response Latency</span>
                  <span className="font-semibold text-foreground font-mono">
                    {health?.latency_ms ?? 0}ms
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <div>
                  <span className="text-muted-foreground block">Tenant Sandbox</span>
                  <span className="font-semibold text-foreground">
                    {health?.services?.tenant?.slug ?? "wwe-os"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <ScanFace className="h-4 w-4 text-teal-400" />
                <div>
                  <span className="text-muted-foreground block">Face AI Engine</span>
                  <span className="font-semibold text-foreground">
                    {health?.services?.face_ai?.enrolled ? "Enrolled & Ready" : "Active"}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Interactive Node Architecture */}
            <div className="relative p-6 rounded-2xl border border-border/50 bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-md overflow-hidden">
              {/* Grid Background pattern */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />

              <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Left Column: Frontend & Client */}
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-cyan-400" />
                    Frontend & Client Layer
                  </div>

                  <NodeCard
                    node={nodes[0]}
                    isSelected={selectedNode === "web_frontend"}
                    onSelect={() => setSelectedNode("web_frontend")}
                  />
                </div>

                {/* Center Column: Platform Kernel Core */}
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 justify-center">
                    <Server className="h-3.5 w-3.5 text-blue-400" />
                    Platform Kernel & AI Services
                  </div>

                  <div className="space-y-3">
                    <NodeCard
                      node={nodes[1]}
                      isSelected={selectedNode === "platform_api"}
                      onSelect={() => setSelectedNode("platform_api")}
                    />
                    <NodeCard
                      node={nodes[2]}
                      isSelected={selectedNode === "face_ai"}
                      onSelect={() => setSelectedNode("face_ai")}
                    />
                  </div>
                </div>

                {/* Right Column: Storage & Multi-Tenant RBAC */}
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-purple-400" />
                    Storage & Multi-Tenant Kernel
                  </div>

                  <div className="space-y-3">
                    <NodeCard
                      node={nodes[3]}
                      isSelected={selectedNode === "database"}
                      onSelect={() => setSelectedNode("database")}
                    />
                    <NodeCard
                      node={nodes[4]}
                      isSelected={selectedNode === "tenant"}
                      onSelect={() => setSelectedNode("tenant")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Node Details Drawer */}
            <AnimatePresence mode="wait">
              {selectedNodeData && (
                <motion.div
                  key={selectedNodeData.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 rounded-xl border border-border/60 bg-muted/10 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg border bg-gradient-to-br ${selectedNodeData.color}`}
                      >
                        <selectedNodeData.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-base">
                          {selectedNodeData.title}
                        </h4>
                        <p className="text-xs text-muted-foreground font-mono">
                          {selectedNodeData.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                          selectedNodeData.status === "online"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : selectedNodeData.status === "degraded"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {selectedNodeData.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {selectedNodeData.details.map((detail, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-1"
                      >
                        <span className="text-muted-foreground block font-medium">
                          {detail.label}
                        </span>
                        <span className="font-semibold text-foreground font-mono truncate block">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
              <span className="font-medium text-muted-foreground">Diagnostics Timestamp</span>
              <span className="font-mono text-foreground font-semibold">
                {health?.timestamp ? new Date(health.timestamp).toLocaleString() : "Just now"}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground text-sm">Component Status Matrix</h4>
              <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-background/50 overflow-hidden">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <node.icon className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-semibold text-foreground block">{node.title}</span>
                        <span className="text-muted-foreground text-[11px] font-mono">
                          {node.subtitle}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-muted-foreground">{node.latency}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {node.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h4 className="font-semibold text-foreground text-sm">
                  Security Enforcement & Session Token Rules
                </h4>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                The platform kernel enforces XSS-safe httpOnly cookies for session state. Client
                JavaScript cannot inspect access tokens directly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg border border-border/40 bg-background/50">
                  <span className="text-muted-foreground block font-medium">
                    Access Token Lifespan
                  </span>
                  <span className="font-bold text-foreground font-mono">15 Minutes</span>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-background/50">
                  <span className="text-muted-foreground block font-medium">
                    Refresh Token Lifespan
                  </span>
                  <span className="font-bold text-foreground font-mono">7 Days (30d Remember)</span>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-background/50">
                  <span className="text-muted-foreground block font-medium">
                    Brute-Force Protection
                  </span>
                  <span className="font-bold text-foreground font-mono">5 Attempts Lockout</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NodeCard({
  node,
  isSelected,
  onSelect,
}: {
  node: {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    accentBg: string;
    status: string;
    latency: string;
  };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = node.icon;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
        isSelected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/5 ring-1 ring-primary/30"
          : "border-border/60 bg-background/60 hover:bg-background hover:border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border bg-gradient-to-br ${node.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              {node.title}
            </h4>
            <p className="text-[11px] text-muted-foreground font-mono">{node.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">{node.latency}</span>
        </div>
      </div>
    </button>
  );
}

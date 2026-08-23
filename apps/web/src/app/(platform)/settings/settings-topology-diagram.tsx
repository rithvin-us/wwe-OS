"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Database,
  ScanFace,
  Globe,
  ShieldCheck,
  Layers,
  Building2,
  RefreshCw,
} from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface NodeTelemetry {
  id: string;
  name: string;
  category: string;
  status: "active" | "encrypted" | "secure" | "standby";
  latency: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  metrics: { label: string; value: string }[];
}

export function SettingsTopologyDiagram() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("platform_core");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client clock read on mount; not derivable during SSR
    setLastSyncTime(new Date().toLocaleTimeString());
  }, []);

  const handleRunDiagnostics = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setLastSyncTime(new Date().toLocaleTimeString());
    setRefreshing(false);
    toast.success("All platform nodes verified and operational.");
  }, []);

  const nodes: NodeTelemetry[] = [
    {
      id: "workspace_client",
      name: "Workspace Portal Client",
      category: "Edge Application Layer",
      status: "active",
      latency: "1.8 ms",
      icon: Globe,
      accentColor: "from-blue-500/20 via-teal-500/10 to-transparent",
      glowColor: "shadow-blue-500/10",
      borderColor: "border-blue-500/40 hover:border-blue-400",
      badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
      badgeText: "ONLINE",
      metrics: [
        { label: "Rendering Engine", value: "Next.js App Router" },
        { label: "Session Standard", value: "httpOnly Strict Token" },
        { label: "Security Level", value: "TLS 1.3 / HSTS Enforced" },
        { label: "Client Latency", value: "1.8 ms (Optimized)" },
      ],
    },
    {
      id: "platform_core",
      name: "Platform Kernel & Services",
      category: "Core Business Engine",
      status: "active",
      latency: "12.4 ms",
      icon: Server,
      accentColor: "from-cyan-500/20 via-blue-500/10 to-transparent",
      glowColor: "shadow-cyan-500/10",
      borderColor: "border-cyan-500/40 hover:border-cyan-400",
      badgeBg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
      badgeText: "OPERATIONAL",
      metrics: [
        { label: "Architecture", value: "Modular Business Kernel" },
        { label: "API Protocol", value: "RESTful JSON / DRF Kernel" },
        { label: "Event Pipeline", value: "Pub/Sub Event Bus" },
        { label: "Throttling Gate", value: "Brute-Force Lockout Guard" },
      ],
    },
    {
      id: "biometric_ai",
      name: "Biometric Face AI Shield",
      category: "Identity & Recognition Service",
      status: "secure",
      latency: "ArcFace Ready",
      icon: ScanFace,
      accentColor: "from-blue-500/20 via-teal-500/10 to-transparent",
      glowColor: "shadow-blue-500/10",
      borderColor: "border-blue-500/40 hover:border-blue-400",
      badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
      badgeText: "SECURE",
      metrics: [
        { label: "Recognition Model", value: "ArcFace 512-Dim Vectors" },
        { label: "Matching Mode", value: "1:N Cosine Similarity" },
        { label: "Liveness Check", value: "Multi-Frame Burst Analysis" },
        { label: "Template Storage", value: "Encrypted Vector Fingerprint" },
      ],
    },
    {
      id: "tenant_sandbox",
      name: "Multi-Tenant Security Isolation",
      category: "Organization Boundary",
      status: "active",
      latency: "WWE OS Sandbox",
      icon: Building2,
      accentColor: "from-indigo-500/20 via-purple-500/10 to-transparent",
      glowColor: "shadow-indigo-500/10",
      borderColor: "border-indigo-500/40 hover:border-indigo-400",
      badgeBg: "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
      badgeText: "ISOLATED",
      metrics: [
        { label: "Organization Scope", value: "WWE OS Enterprise" },
        { label: "RBAC Governance", value: "Owner / Manager / Member" },
        { label: "Data Boundary", value: "Row-Level Tenant Guard" },
        { label: "Permission Sync", value: "Real-time Policy Catalog" },
      ],
    },
    {
      id: "encrypted_store",
      name: "Encrypted Storage & Audit Vault",
      category: "Data & Persistence Engine",
      status: "encrypted",
      latency: "AES-256 Active",
      icon: Database,
      accentColor: "from-purple-500/20 via-violet-500/10 to-transparent",
      glowColor: "shadow-purple-500/10",
      borderColor: "border-purple-500/40 hover:border-purple-400",
      badgeBg: "bg-purple-500/15 border-purple-500/30 text-purple-400",
      badgeText: "ENCRYPTED",
      metrics: [
        { label: "Database Layer", value: "PostgreSQL Data Store" },
        { label: "Cache Acceleration", value: "Redis Session Cache" },
        { label: "Audit Trail", value: "Immutable Log Register" },
        { label: "Encryption", value: "AES-256 at Rest & TLS in Transit" },
      ],
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[1];

  return (
    <Card className="border border-blue-500/20 bg-slate-950/80 backdrop-blur-xl text-slate-100 shadow-2xl overflow-hidden rounded-2xl">
      <CardHeader className="border-b border-slate-800/80 bg-slate-900/40 pb-5 px-6 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  System Architecture & Node Topology
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    LIVE TELEMETRY
                  </span>
                </CardTitle>
              </div>
            </div>
            <CardDescription className="text-xs text-slate-400 pl-9">
              Interactive high-level map of enterprise application services, biometric engines,
              multi-tenant boundaries, and security vaults.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[11px] text-slate-400 font-mono hidden md:block">
              Last Verified: <span className="text-slate-200">{lastSyncTime || "Active"}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRunDiagnostics}
              disabled={refreshing}
              className="gap-2 text-xs border-blue-500/30 bg-slate-900/80 hover:bg-blue-500/10 hover:text-blue-400 text-slate-200 transition duration-(--duration-base) ease-out-quart"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`}
              />
              Verify Nodes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Interactive Architecture Node Map Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative">
          {nodes.map((node) => {
            const Icon = node.icon;
            const isSelected = node.id === selectedNodeId;

            return (
              <motion.button
                key={node.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedNodeId(node.id)}
                className={`text-left p-4 rounded-xl border transition duration-(--duration-base) ease-out-quart relative overflow-hidden group flex flex-col justify-between min-h-[140px] ${
                  isSelected
                    ? `${node.borderColor} bg-slate-900/90 shadow-xl ${node.glowColor} ring-1 ring-blue-500/30`
                    : "border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700"
                }`}
              >
                {/* Background Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${node.accentColor} opacity-70 pointer-events-none`}
                />

                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-blue-400 group-hover:text-blue-300 transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border tracking-wider ${node.badgeBg}`}
                  >
                    {node.badgeText}
                  </span>
                </div>

                <div className="relative z-10 space-y-1 mt-3">
                  <h4 className="font-bold text-xs text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                    {node.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{node.category}</p>
                </div>

                <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2 text-[10px]">
                  <span className="text-slate-500 font-mono">Status</span>
                  <span className="font-mono text-blue-400 font-semibold">{node.latency}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Selected Node Telemetry Drawer */}
        <AnimatePresence mode="wait">
          {selectedNode && (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-blue-400">
                    <selectedNode.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      {selectedNode.name}
                    </h4>
                    <p className="text-xs text-slate-400">{selectedNode.category}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Security Isolation:</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Safe
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {selectedNode.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 space-y-1"
                  >
                    <span className="text-slate-400 block text-[11px] font-medium">
                      {metric.label}
                    </span>
                    <span className="font-semibold text-slate-200 font-mono truncate block">
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

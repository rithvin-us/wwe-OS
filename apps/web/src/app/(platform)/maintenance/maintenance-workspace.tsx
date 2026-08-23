"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  GitCommit,
  Key,
  ScanFace,
  ScrollText,
} from "@bop/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { StatusChip, type PlatformStatus } from "@bop/ui/components/status";

import { ConfigForm } from "@/app/(platform)/maintenance/config-form";
import type {
  AIOperations,
  AIUsageByModule,
  AIUsageTotals,
  AuditEntry,
  CurrentPeriod,
  FaceDiagnostics,
  RuntimeStatus,
  TenantConfig,
} from "@/lib/maintenance";

interface MaintenanceWorkspaceProps {
  tenantConfig: TenantConfig;
  aiUsage: { totals: AIUsageTotals; by_model: unknown[]; by_module: AIUsageByModule[] };
  aiOps: AIOperations;
  runtime: { data: RuntimeStatus; reachable: boolean };
  faceDiag: FaceDiagnostics | null;
  period: CurrentPeriod | null;
  activity: AuditEntry[];
  telegramBillsCount: number | null;
  notificationsSentCount: number | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}

const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.15 },
};

export function MaintenanceWorkspace({
  tenantConfig,
  aiUsage,
  aiOps,
  runtime,
  faceDiag,
  period,
  activity,
  telegramBillsCount,
  notificationsSentCount,
}: MaintenanceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "ai_gateway" | "face_checkin" | "activity" | "integrations"
  >("overview");

  const backendOk =
    runtime.reachable && Object.values(runtime.data.checks).every((v) => v === "ok");
  const backendStatus: PlatformStatus = runtime.reachable
    ? backendOk
      ? "operational"
      : "attention"
    : "attention";

  const aiStatus: PlatformStatus =
    aiOps.success_rate === null
      ? "building"
      : aiOps.success_rate >= 0.95
        ? "operational"
        : "attention";

  const faceStatus: PlatformStatus =
    faceDiag === null ? "attention" : faceDiag.status === "healthy" ? "operational" : "attention";

  const periodStatus: PlatformStatus =
    period === null ? "planned" : period.is_locked ? "operational" : "building";

  const tabs = [
    {
      id: "overview" as const,
      label: "Overview",
      description: "Deploy, runtime & backend health",
      icon: Activity,
      badge: backendStatus === "operational" ? "HEALTHY" : "ATTENTION",
    },
    {
      id: "ai_gateway" as const,
      label: "AI Gateway",
      description: "Success rate, failures & cost",
      icon: BrainCircuit,
      badge:
        aiOps.success_rate === null ? "NO DATA" : `${Math.round(aiOps.success_rate * 100)}% OK`,
    },
    {
      id: "face_checkin" as const,
      label: "Face Check-in",
      description: "Engine wiring & live probe",
      icon: ScanFace,
      badge: faceDiag ? faceDiag.status.toUpperCase() : "UNREACHABLE",
    },
    {
      id: "activity" as const,
      label: "Activity",
      description: "Audit trail across every module",
      icon: ScrollText,
      badge: String(activity.length),
    },
    {
      id: "integrations" as const,
      label: "Integrations",
      description: "API keys & AI provider config",
      icon: Key,
      badge: "API KEYS",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Maintenance Tab Selector Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-1.5 rounded-2xl bg-muted/40 border border-border/60 backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start p-3 rounded-xl transition duration-(--duration-base) ease-out-quart text-left relative overflow-hidden group ${
                isActive
                  ? "bg-background text-foreground shadow-md border border-border/80 ring-1 ring-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="font-bold text-xs tracking-tight block truncate w-full">
                {tab.label}
              </span>
              <span className="text-[10px] text-muted-foreground truncate w-full block font-normal">
                {tab.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Workspace Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" {...fadeIn} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium">Backend</span>
                  <StatusChip status={backendStatus} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium">AI Gateway</span>
                  <StatusChip status={aiStatus} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium">Face Check-in</span>
                  <StatusChip status={faceStatus} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium">Current Period</span>
                  <StatusChip status={periodStatus} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-emerald-400" />
                    Deploy &amp; Runtime
                  </CardTitle>
                  <CardDescription>What&apos;s actually live right now.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!runtime.reachable ? (
                    <p className="text-sm text-destructive">
                      Backend unreachable — the API server did not respond.
                    </p>
                  ) : (
                    <div>
                      <KV
                        label="Commit"
                        value={
                          runtime.data.deploy.commit ??
                          (runtime.data.deploy.on_render ? "—" : "local dev")
                        }
                      />
                      <KV label="Branch" value={runtime.data.deploy.branch ?? "—"} />
                      <KV label="Database" value={runtime.data.checks.database ?? "—"} />
                      <KV label="Cache" value={runtime.data.checks.cache ?? "—"} />
                      <KV label="AI default model" value={runtime.data.config.ai_default_model} />
                      <KV
                        label="AI fallback model"
                        value={runtime.data.config.ai_fallback_model ?? "none"}
                      />
                      <KV
                        label="Invoice PDF engine"
                        value={runtime.data.config.invoice_pdf_engine}
                      />
                      <KV label="Debug mode" value={runtime.data.config.debug ? "ON" : "off"} />
                      <KV
                        label="Requests"
                        value={`${runtime.data.requests.total_requests} (${runtime.data.requests.requests_by_status["5xx"] ?? 0} 5xx)`}
                      />
                      <KV
                        label="Avg latency"
                        value={
                          runtime.data.requests.avg_duration_ms !== null
                            ? `${runtime.data.requests.avg_duration_ms}ms`
                            : "—"
                        }
                      />
                      <p className="pt-2 text-[11px] text-muted-foreground">
                        {runtime.data.requests.note}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-emerald-400" />
                    Current Business Period
                  </CardTitle>
                  <CardDescription>
                    Whether this month&apos;s books are locked for edits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {period === null ? (
                    <p className="text-sm text-muted-foreground">
                      No period record yet for this month — nothing has been filed.
                    </p>
                  ) : (
                    <div>
                      <KV
                        label="Period"
                        value={`${period.year}-${String(period.month).padStart(2, "0")}`}
                      />
                      <KV label="Status" value={period.status ?? "—"} />
                      <KV label="Locked" value={period.is_locked ? "yes" : "no"} />
                      {period.locked_at ? (
                        <KV label="Locked at" value={timeAgo(period.locked_at)} />
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {activeTab === "ai_gateway" && (
          <motion.div key="ai_gateway" {...fadeIn} className="space-y-4">
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-emerald-400" />
                  AI Gateway Operations
                </CardTitle>
                <CardDescription>
                  Last 24h — every AI call, real success/failure, not just whether a key is
                  configured.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Calls (24h)</p>
                    <p className="text-2xl font-bold">{aiOps.calls}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Failures (24h)</p>
                    <p
                      className={`text-2xl font-bold ${aiOps.failures > 0 ? "text-destructive" : ""}`}
                    >
                      {aiOps.failures}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Success rate</p>
                    <p className="text-2xl font-bold">
                      {aiOps.success_rate === null
                        ? "—"
                        : `${Math.round(aiOps.success_rate * 100)}%`}
                    </p>
                  </div>
                </div>

                {aiOps.by_model.length > 0 ? (
                  <div className="mb-6 space-y-1">
                    <h4 className="text-sm font-medium border-b pb-2 mb-2">By model (24h)</h4>
                    {aiOps.by_model.map((m) => (
                      <div key={m.model} className="flex items-center justify-between text-sm py-1">
                        <span className="font-mono text-[13px]">{m.model}</span>
                        <span className="text-muted-foreground">
                          {m.calls} calls
                          {m.failures > 0 ? (
                            <span className="ml-2 text-destructive">{m.failures} failed</span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium border-b pb-2">Recent failures</h4>
                  {aiOps.recent_failures.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No failed AI calls on record — clean.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {aiOps.recent_failures.map((f, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between font-mono font-medium text-foreground">
                            <span>
                              {f.module}
                              {f.use_case ? ` / ${f.use_case}` : ""} · {f.model}
                            </span>
                            <span className="text-muted-foreground">{timeAgo(f.created_at)}</span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {f.error || "No error message recorded."}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  AI Usage &amp; Cost Analytics
                </CardTitle>
                <CardDescription>All-time usage and cost across the platform.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Total API Calls</p>
                    <p className="text-2xl font-bold">{aiUsage.totals?.calls || 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Total Tokens</p>
                    <p className="text-2xl font-bold">
                      {(aiUsage.totals?.input_tokens || 0) + (aiUsage.totals?.output_tokens || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">
                      ${Number(aiUsage.totals?.cost_usd || 0).toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium border-b pb-2">Usage by Module</h4>
                  {!aiUsage.by_module || aiUsage.by_module.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {aiUsage.by_module.map((mod, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span>{mod.module}</span>
                          <span className="font-mono text-muted-foreground">
                            {mod.calls} calls (${Number(mod.cost_usd).toFixed(4)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "face_checkin" && (
          <motion.div key="face_checkin" {...fadeIn}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 pb-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ScanFace className="h-4 w-4 text-emerald-400" />
                    Face Check-in Diagnostics
                  </CardTitle>
                  <CardDescription>
                    Engine wiring, enrolled-template health, and a live probe of the face-ai
                    service.
                  </CardDescription>
                </div>
                {faceDiag ? <StatusChip status={faceStatus} /> : null}
              </CardHeader>
              <CardContent className="pt-6">
                {faceDiag === null ? (
                  <p className="text-sm text-destructive">
                    Could not reach the diagnostics endpoint — the HR module or its permissions may
                    not be set up yet.
                  </p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium border-b pb-2 mb-1">Engine</h4>
                      {Object.entries(faceDiag.config).map(([k, v]) => (
                        <KV key={k} label={k} value={String(v)} />
                      ))}
                      <h4 className="text-sm font-medium border-b pb-2 mb-1 mt-4">
                        Enrolled gallery
                      </h4>
                      <KV label="Employees enrolled" value={faceDiag.gallery.enrolled} />
                      <KV label="Unreadable templates" value={faceDiag.gallery.unreadable} />
                      <KV
                        label="Embedding dimensions"
                        value={
                          Object.keys(faceDiag.gallery.dimensions).length > 0
                            ? Object.entries(faceDiag.gallery.dimensions)
                                .map(([d, c]) => `${d}d ×${c}`)
                                .join(", ")
                            : "—"
                        }
                      />
                      {Object.keys(faceDiag.live).length > 0 ? (
                        <>
                          <h4 className="text-sm font-medium border-b pb-2 mb-1 mt-4">
                            Live face-ai probe
                          </h4>
                          {Object.entries(faceDiag.live).map(([k, v]) => (
                            <KV key={k} label={k} value={v === null ? "—" : String(v)} />
                          ))}
                        </>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {faceDiag.problems.length > 0 ? (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                            <AlertTriangle className="size-4" />
                            Problems
                          </h4>
                          <ul className="space-y-2">
                            {faceDiag.problems.map((p, i) => (
                              <li
                                key={i}
                                className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-foreground"
                              >
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {faceDiag.warnings.length > 0 ? (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-warning">
                            <AlertTriangle className="size-4" />
                            Warnings
                          </h4>
                          <ul className="space-y-2">
                            {faceDiag.warnings.map((w, i) => (
                              <li
                                key={i}
                                className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-foreground"
                              >
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {faceDiag.problems.length === 0 && faceDiag.warnings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No problems or warnings — check-in pipeline looks healthy.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "activity" && (
          <motion.div key="activity" {...fadeIn}>
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-emerald-400" />
                  Recent Activity
                </CardTitle>
                <CardDescription>What changed most recently, across every module.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {activity.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <span>
                          <span className="font-medium">{a.module}</span>{" "}
                          <span className="text-muted-foreground">{a.action}</span>{" "}
                          {a.object_type ? (
                            <span className="text-muted-foreground">· {a.object_type}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "integrations" && (
          <motion.div key="integrations" {...fadeIn}>
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-400" />
                  Subscriptions &amp; API Keys
                </CardTitle>
                <CardDescription>Manage third-party integrations and billing.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ConfigForm
                  config={tenantConfig || {}}
                  telegramBillsCount={telegramBillsCount}
                  notificationsSentCount={notificationsSentCount}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

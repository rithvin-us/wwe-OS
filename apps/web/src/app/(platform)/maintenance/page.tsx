import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import { StatusChip, type PlatformStatus } from "@bop/ui/components/status";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  GitCommit,
  Key,
  ScanFace,
  ScrollText,
  ServerCog,
} from "@bop/icons";
import { ConfigForm } from "./config-form";
import {
  getAIOperations,
  getAIUsage,
  getCurrentPeriod,
  getFaceDiagnostics,
  getRecentActivity,
  getRuntimeStatus,
  getTenantConfig,
} from "@/lib/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

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

export default async function MaintenancePage() {
  const [tenantConfig, aiUsage, aiOps, runtime, faceDiag, period, activity] = await Promise.all([
    getTenantConfig(),
    getAIUsage(),
    getAIOperations(),
    getRuntimeStatus(),
    getFaceDiagnostics(),
    getCurrentPeriod(),
    getRecentActivity(),
  ]);

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
    faceDiag === null
      ? "attention"
      : faceDiag.status === "healthy"
        ? "operational"
        : faceDiag.status === "warning"
          ? "attention"
          : "attention";

  const periodStatus: PlatformStatus =
    period === null ? "planned" : period.is_locked ? "operational" : "building";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Maintenance"
        description="Live health, AI gateway operations, and diagnostics — a developer's view of what's actually running."
      />

      {/* At-a-glance strip — the "is anything broken right now" answer */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ServerCog className="size-4 text-muted-foreground" />
              Backend
            </div>
            <StatusChip status={backendStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BrainCircuit className="size-4 text-muted-foreground" />
              AI Gateway
            </div>
            <StatusChip status={aiStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScanFace className="size-4 text-muted-foreground" />
              Face Check-in
            </div>
            <StatusChip status={faceStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-muted-foreground" />
              Current Period
            </div>
            <StatusChip status={periodStatus} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Deploy & runtime */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <GitCommit className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Deploy &amp; Runtime</CardTitle>
              <CardDescription>What&apos;s actually live right now.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
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
                <KV label="Invoice PDF engine" value={runtime.data.config.invoice_pdf_engine} />
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

        {/* Business period */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Current Business Period</CardTitle>
              <CardDescription>
                Whether this month&apos;s books are locked for edits.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
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

      {/* AI Gateway Operations — real success/failure, not "is a key configured" */}
      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 pb-2">
          <BrainCircuit className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">AI Gateway Operations</CardTitle>
            <CardDescription>
              Last 24h — every AI call, real success/failure, not just whether a key is configured.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Calls (24h)</p>
              <p className="text-2xl font-bold">{aiOps.calls}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Failures (24h)</p>
              <p className={`text-2xl font-bold ${aiOps.failures > 0 ? "text-destructive" : ""}`}>
                {aiOps.failures}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Success rate</p>
              <p className="text-2xl font-bold">
                {aiOps.success_rate === null ? "—" : `${Math.round(aiOps.success_rate * 100)}%`}
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
              <p className="text-sm text-muted-foreground">No failed AI calls on record — clean.</p>
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

      {/* Face check-in diagnostics — same checks as `manage.py face_doctor` */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <ScanFace className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Face Check-in Diagnostics</CardTitle>
              <CardDescription>
                Engine wiring, enrolled-template health, and a live probe of the face-ai service.
              </CardDescription>
            </div>
          </div>
          {faceDiag ? <StatusChip status={faceStatus} /> : null}
        </CardHeader>
        <CardContent>
          {faceDiag === null ? (
            <p className="text-sm text-destructive">
              Could not reach the diagnostics endpoint — the HR module or its permissions may not be
              set up yet.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium border-b pb-2 mb-1">Engine</h4>
                {Object.entries(faceDiag.config).map(([k, v]) => (
                  <KV key={k} label={k} value={String(v)} />
                ))}
                <h4 className="text-sm font-medium border-b pb-2 mb-1 mt-4">Enrolled gallery</h4>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity — the audit trail */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>What changed most recently, across every module.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
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
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions & API keys */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Subscriptions &amp; API Keys</CardTitle>
              <CardDescription>Manage third-party integrations and billing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ConfigForm config={tenantConfig.config || {}} />
          </CardContent>
        </Card>
      </div>

      {/* AI usage & cost analytics */}
      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 pb-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">AI Usage &amp; Cost Analytics</CardTitle>
            <CardDescription>All-time usage and cost across the platform.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}

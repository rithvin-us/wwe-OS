import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import { Activity, Key, BrainCircuit } from "@bop/icons";
import { ConfigForm } from "./config-form";
import { getTenantConfig, getAIUsage, getBackendHealth } from "@/lib/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

export default async function MaintenancePage() {
  const [tenantConfig, aiUsage, health] = await Promise.all([
    getTenantConfig(),
    getAIUsage(),
    getBackendHealth(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Maintenance"
        description="Monitor system health, manage subscriptions and API keys, and view diagnostics."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">System Health</CardTitle>
              <CardDescription>Real-time status of backend services.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">API Gateway</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Backend Services</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    health.status === "healthy"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {health.status === "healthy" ? "Healthy" : "Unhealthy"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium">AI Providers</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Available
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Subscriptions & API Keys</CardTitle>
              <CardDescription>Manage third-party integrations and billing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ConfigForm config={tenantConfig.config || {}} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 pb-2">
          <BrainCircuit className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">AI Analytics</CardTitle>
            <CardDescription>Usage and cost metrics across the platform.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
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
                {aiUsage.by_module.map((mod: any, i: number) => (
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

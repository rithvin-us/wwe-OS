import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { MaintenanceWorkspace } from "@/app/(platform)/maintenance/maintenance-workspace";
import {
  getAIOperations,
  getAIUsage,
  getCurrentPeriod,
  getFaceDiagnostics,
  getNotificationsSentCount,
  getRecentActivity,
  getRuntimeStatus,
  getTelegramBillsCount,
  getTenantConfig,
} from "@/lib/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

export default async function MaintenancePage() {
  const [
    tenantConfig,
    aiUsage,
    aiOps,
    runtime,
    faceDiag,
    period,
    activity,
    telegramBillsCount,
    notificationsSentCount,
  ] = await Promise.all([
    getTenantConfig(),
    getAIUsage(),
    getAIOperations(),
    getRuntimeStatus(),
    getFaceDiagnostics(),
    getCurrentPeriod(),
    getRecentActivity(),
    getTelegramBillsCount(),
    getNotificationsSentCount(),
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Maintenance & Diagnostics"
        description="Live health, AI gateway operations, and diagnostics — a developer's view of what's actually running."
      />

      <MaintenanceWorkspace
        tenantConfig={tenantConfig.config || {}}
        aiUsage={aiUsage}
        aiOps={aiOps}
        runtime={runtime}
        faceDiag={faceDiag}
        period={period}
        activity={activity}
        telegramBillsCount={telegramBillsCount}
        notificationsSentCount={notificationsSentCount}
      />
    </div>
  );
}

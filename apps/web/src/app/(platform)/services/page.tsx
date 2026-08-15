import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { AVAILABILITY_LABEL, SERVICES } from "@/config/modules";
import {
  getDocumentsScannedCount,
  getNotificationsSentCount,
  getTelegramBillsCount,
} from "@/lib/services-activity";

export const metadata: Metadata = {
  title: "Services",
};

function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

/**
 * The one quiet page about background services. Plain language, nothing to
 * click, nothing to manage — it exists so the platform has no mystery, not
 * so users operate machinery. Where a service has done real work, that shows
 * up as one real number; where it hasn't run yet, the line stays blank
 * rather than guessing.
 */
export default async function ServicesPage() {
  const [documentsScanned, telegramBills, notificationsSent] = await Promise.all([
    getDocumentsScannedCount(),
    getTelegramBillsCount(),
    getNotificationsSentCount(),
  ]);

  const activityBySlug: Record<string, string | null> = {
    ocr: documentsScanned ? `${formatCount(documentsScanned)} documents scanned so far` : null,
    telegram: telegramBills ? `${formatCount(telegramBills)} bills received via Telegram` : null,
    notifications: notificationsSent
      ? `${formatCount(notificationsSent)} notifications sent so far`
      : null,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Services"
        description="These work quietly in the background so the apps can do their job. There's nothing to set up here."
      />

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {SERVICES.map((service) => {
          const label = AVAILABILITY_LABEL[service.availability];
          const activity = activityBySlug[service.slug];
          return (
            <li key={service.slug} className="flex items-start gap-3.5 px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                <service.icon aria-hidden className="size-4 text-secondary-foreground/80" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {service.name}
                  {label ? (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {label}
                    </span>
                  ) : null}
                </p>
                <p className="text-[13px] text-muted-foreground">{service.plain}</p>
                {activity ? (
                  <p className="text-[12px] font-medium text-foreground/70">{activity}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import { ChevronRight, MapPin } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";

import { formatRupees } from "@/config/invoices";
import { encodeSiteKey, getSites } from "@/lib/sites";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const sites = await getSites();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sites"
        description="Every facility invoices have been raised for. Open one for its 360° view — customers, invoices, AMC and activity."
      />

      {sites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No sites yet"
          description="Raise an invoice against a facility and it appears here as a site."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {sites.map((site) => (
              <Link
                key={site.name}
                href={`/sites/${encodeSiteKey(site.name)}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{site.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {site.customers.length > 0 ? site.customers.join(", ") : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {site.is_sez ? <Badge variant="outline">SEZ</Badge> : null}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {site.invoice_count} · {formatRupees(site.total_invoiced)}
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

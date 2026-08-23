import { Activity, ArrowLeft, Building2, Receipt } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  formatInvoiceDate,
  formatRupees,
} from "@/config/invoices";
import { ApiRequestError } from "@/lib/api/envelope";
import { activityLabel } from "@/lib/customers";
import {
  type SiteInvoiceRow,
  type SiteOverview,
  decodeSiteKey,
  getSiteOverview,
  unlinkedLabel,
} from "@/lib/sites";

export const metadata = { title: "Site" };

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function InvoiceRows({ rows, empty }: { rows: SiteInvoiceRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.number}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatInvoiceDate(row.invoice_date)}
              {row.customer ? ` · ${row.customer}` : ""}
              {row.period_text ? ` · ${row.period_text}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="outline">{INVOICE_TYPE_LABELS[row.invoice_type]}</Badge>
            <span className="text-sm font-medium tabular-nums">{formatRupees(row.total)}</span>
            <Badge variant={row.status === "cancelled" ? "secondary" : "success"}>
              {INVOICE_STATUS_LABELS[row.status] ?? row.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SiteOverviewPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const name = decodeSiteKey(key);
  let data: SiteOverview;
  try {
    data = await getSiteOverview(name);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const { financials, customers, invoices, amc, activity, unlinked } = data;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/sites">
            <ArrowLeft aria-hidden />
            Sites
          </Link>
        </Button>
        <PageHeader
          title={data.name}
          description={customers.length > 0 ? customers.join(", ") : "Facility"}
          meta={data.is_sez ? <Badge variant="outline">SEZ</Badge> : undefined}
        />
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-6 py-6">
          <Figure label="Invoiced" value={formatRupees(financials.total_invoiced)} />
          <Figure label="Invoices" value={String(financials.active_count)} />
          <Figure label="AMC" value={String(financials.amc_count)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Receipt aria-hidden className="size-4 text-muted-foreground" />
                Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceRows rows={invoices} empty="No invoices raised for this site yet." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AMC</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceRows rows={amc} empty="No AMC invoices for this site yet." />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 aria-hidden className="size-4 text-muted-foreground" />
                Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No customer on record.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {customers.map((customer) => (
                    <li key={customer} className="font-medium">
                      {customer}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity aria-hidden className="size-4 text-muted-foreground" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((entry, index) => (
                    <li key={`${entry.object_id}-${index}`} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
                      />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{activityLabel(entry.action)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.number ? `${entry.number} · ` : ""}
                          {formatInvoiceDate(entry.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {unlinked.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Not yet linked to sites</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {unlinked.map((area) => (
                    <Badge key={area} variant="secondary">
                      {unlinkedLabel(area)}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  These areas don&rsquo;t carry a facility link in the data yet, so they&rsquo;re
                  not shown here rather than guessed.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

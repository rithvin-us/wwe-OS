import { Activity, ArrowLeft, Building2, MapPin, Receipt } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  formatInvoiceDate,
  formatRupees,
} from "@/config/invoices";
import { ApiRequestError } from "@/lib/api/envelope";
import {
  type CustomerInvoiceRow,
  type CustomerOverview,
  activityLabel,
  getCustomerOverview,
} from "@/lib/customers";

export const metadata = { title: "Customer" };

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

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

function InvoiceStatusBadge({ status }: { status: CustomerInvoiceRow["status"] }) {
  return (
    <Badge variant={status === "cancelled" ? "secondary" : "success"}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function InvoiceRows({ rows, empty }: { rows: CustomerInvoiceRow[]; empty: string }) {
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
              {row.facility ? ` · ${row.facility}` : ""}
              {row.period_text ? ` · ${row.period_text}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="outline">{INVOICE_TYPE_LABELS[row.invoice_type]}</Badge>
            <span className="text-sm font-medium tabular-nums">{formatRupees(row.total)}</span>
            <InvoiceStatusBadge status={row.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function CustomerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: CustomerOverview;
  try {
    data = await getCustomerOverview(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const { customer, financials, sites, invoices, amc, activity } = data;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/customers">
            <ArrowLeft aria-hidden />
            Customers
          </Link>
        </Button>
        <PageHeader
          title={customer.name}
          description={
            [customer.state, customer.gstin].filter(Boolean).join(" · ") || "Billing customer"
          }
          meta={
            <div className="flex items-center gap-2">
              {customer.is_sez ? <Badge variant="outline">SEZ</Badge> : null}
              <Badge variant={customer.is_active ? "success" : "secondary"}>
                {customer.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          }
        />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
          <Figure label="Invoiced" value={formatRupees(financials.total_invoiced)} />
          <Figure label="Invoices" value={String(financials.active_count)} />
          <Figure label="AMC" value={String(financials.amc_count)} />
          <Figure
            label="Outstanding"
            value={financials.outstanding === null ? "—" : formatRupees(financials.outstanding)}
          />
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
              <InvoiceRows rows={invoices} empty="No invoices raised for this customer yet." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AMC</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceRows rows={amc} empty="No AMC invoices for this customer yet." />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <MetaRow label="GSTIN">{customer.gstin || "—"}</MetaRow>
              <MetaRow label="State">{customer.state || "—"}</MetaRow>
              <MetaRow label="Tax mode">{customer.is_sez ? "IGST (SEZ)" : "CGST + SGST"}</MetaRow>
              <MetaRow label="Default facility">{customer.facility || "—"}</MetaRow>
              <MetaRow label="Cancelled bills">{financials.cancelled_count}</MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin aria-hidden className="size-4 text-muted-foreground" />
                Sites
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sites.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No site on record yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {sites.map((site) => (
                    <div key={site.name} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Building2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{site.name}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {site.invoice_count} · {formatRupees(site.total_invoiced)}
                      </span>
                    </div>
                  ))}
                </div>
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
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Building2, ChevronRight, Users } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";

import { getCustomers } from "@/lib/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Every billing customer. Open one for its 360° view — invoices, sites, AMC and recent activity."
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add a billing customer from the Invoices area and it appears here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Building2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[customer.facility, customer.state].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {customer.is_sez ? <Badge variant="outline">SEZ</Badge> : null}
                  {!customer.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
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

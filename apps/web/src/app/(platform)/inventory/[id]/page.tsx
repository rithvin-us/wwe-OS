import { ArrowLeft } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { StockActions } from "@/app/(platform)/inventory/[id]/stock-actions";
import { ApiRequestError } from "@/lib/api/envelope";
import {
  formatDateTime,
  formatMoney,
  formatQty,
  getItem,
  getItemMovements,
  type InventoryItemRecord,
  type StockMovementRecord,
} from "@/lib/inventory";

// Deduped per request so generateMetadata and the page body share one fetch.
const getItemCached = cache(getItem);

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function MovementRow({ movement }: { movement: StockMovementRecord }) {
  const positive = Number(movement.delta) >= 0;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{movement.movement_label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDateTime(movement.created_at)}
          {movement.reason ? ` · ${movement.reason}` : ""}
          {movement.reference ? ` · ref ${movement.reference}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-medium tabular-nums ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? "+" : ""}
          {movement.delta}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">→ {movement.balance_after}</p>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getItemCached(id);
    return { title: item.name };
  } catch {
    return { title: "Inventory item" };
  }
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: InventoryItemRecord;
  try {
    item = await getItemCached(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const movements = await getItemMovements(id);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/inventory">
            <ArrowLeft aria-hidden />
            Inventory
          </Link>
        </Button>
        <PageHeader
          title={item.name}
          description={`SKU ${item.sku}${item.category ? ` · ${item.category}` : ""}`}
          meta={!item.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
          actions={<StockActions id={item.id} unit={item.unit} hasHistory={movements.length > 0} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">On hand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-display text-3xl font-semibold tabular-nums">
              {formatQty(item.quantity_on_hand, item.unit)}
            </p>
            <div className="divide-y divide-border">
              <MetaRow label="Unit cost">{formatMoney(item.unit_cost, item.currency)}</MetaRow>
              <MetaRow label="Stock value">{formatMoney(item.stock_value, item.currency)}</MetaRow>
              <MetaRow label="Location">{item.location || "—"}</MetaRow>
              <MetaRow label="Supplier">{item.supplier || "—"}</MetaRow>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock history</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No movements yet. Record a goods receipt to set the opening stock.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((movement) => (
                  <MovementRow key={movement.id} movement={movement} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

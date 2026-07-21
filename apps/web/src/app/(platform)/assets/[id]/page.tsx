import { ArrowLeft, Download, Wrench } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AssetActions } from "@/app/(platform)/assets/[id]/asset-actions";
import { ApiRequestError } from "@/lib/api/envelope";
import {
  type AssetMaintenanceRecord,
  type AssetRecord,
  formatDate,
  formatMoney,
  getAsset,
  getAssetMaintenance,
} from "@/lib/assets";

function StatusBadge({ asset }: { asset: AssetRecord }) {
  if (asset.status === "assigned") return <Badge variant="success">{asset.status_label}</Badge>;
  if (asset.status === "in_maintenance")
    return <Badge variant="warning">{asset.status_label}</Badge>;
  if (asset.status === "disposed") return <Badge variant="secondary">{asset.status_label}</Badge>;
  return <Badge variant="outline">{asset.status_label}</Badge>;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function MaintenanceRow({ record }: { record: AssetMaintenanceRecord }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{record.description}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(record.performed_on)}
          {record.vendor ? ` · ${record.vendor}` : ""}
        </p>
      </div>
      <span className="tabular-nums text-muted-foreground">
        {formatMoney(record.cost, record.currency)}
      </span>
    </div>
  );
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let asset: AssetRecord;
  try {
    asset = await getAsset(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const maintenance = await getAssetMaintenance(id);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/assets">
            <ArrowLeft aria-hidden />
            Assets
          </Link>
        </Button>
        <PageHeader
          title={asset.name}
          description={`${asset.asset_tag} · ${asset.category_label}`}
          meta={<StatusBadge asset={asset} />}
          actions={
            <AssetActions
              id={asset.id}
              status={asset.status}
              hasFile={asset.file_name !== null}
              hasHistory={maintenance.length > 0}
            />
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <MetaRow label="Assigned to">{asset.assigned_to || "—"}</MetaRow>
            <MetaRow label="Serial">{asset.serial_number || "—"}</MetaRow>
            <MetaRow label="Purchased">{formatDate(asset.purchase_date)}</MetaRow>
            <MetaRow label="Cost">{formatMoney(asset.purchase_cost, asset.currency)}</MetaRow>
            <MetaRow label="Supplier">{asset.supplier || "—"}</MetaRow>
            <MetaRow label="Location">{asset.location || "—"}</MetaRow>
            {asset.status === "disposed" ? (
              <MetaRow label="Disposal">{asset.disposal_reason || "—"}</MetaRow>
            ) : null}
            {asset.file_name ? (
              <div className="pt-3">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <a href={`/api/assets/${asset.id}/download`}>
                    <Download aria-hidden />
                    {asset.file_name}
                  </a>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench aria-hidden className="size-4 text-muted-foreground" />
              Maintenance history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {maintenance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No maintenance recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {maintenance.map((record) => (
                  <MaintenanceRow key={record.id} record={record} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

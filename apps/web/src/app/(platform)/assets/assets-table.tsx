"use client";

import { Landmark } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { type AssetRecord, type AssetStatus, formatMoney } from "@/lib/assets-constants";

const STATUS_FILTERS: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "assigned", label: "Assigned" },
  { value: "in_maintenance", label: "In maintenance" },
  { value: "disposed", label: "Disposed" },
];

function StatusBadge({ asset }: { asset: AssetRecord }) {
  if (asset.status === "assigned") return <Badge variant="success">{asset.status_label}</Badge>;
  if (asset.status === "in_maintenance")
    return <Badge variant="warning">{asset.status_label}</Badge>;
  if (asset.status === "disposed") return <Badge variant="secondary">{asset.status_label}</Badge>;
  return <Badge variant="outline">{asset.status_label}</Badge>;
}

const columns: ColumnDef<AssetRecord, unknown>[] = [
  {
    accessorKey: "asset_tag",
    header: "Tag",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.asset_tag}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Asset",
    cell: ({ row }) => (
      <Link
        href={`/assets/${row.original.id}`}
        className="font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.category_label}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge asset={row.original} />,
  },
  {
    accessorKey: "assigned_to",
    header: "Assigned to",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.assigned_to || "—"}</span>
    ),
  },
  {
    id: "cost",
    header: "Cost",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatMoney(row.original.purchase_cost, row.original.currency)}
      </span>
    ),
  },
];

export function AssetsTable({ assets }: { assets: AssetRecord[] }) {
  const [filter, setFilter] = useState<AssetStatus | "all">("all");
  const rows = filter === "all" ? assets : assets.filter((a) => a.status === filter);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? "secondary" : "ghost"}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(asset) => asset.id}
        empty={{
          icon: Landmark,
          title: assets.length === 0 ? "No assets yet" : "Nothing in this view",
          description:
            assets.length === 0
              ? "Add an asset to track who holds it, its servicing, and its disposal."
              : "No assets match this filter. Try another.",
        }}
      />
    </section>
  );
}

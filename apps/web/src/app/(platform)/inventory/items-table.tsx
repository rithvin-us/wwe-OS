"use client";

import { Boxes, TriangleAlert } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { formatMoney, formatQty, type InventoryItemRecord } from "@/lib/inventory-constants";

type Filter = "all" | "low" | "active" | "inactive";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function match(item: InventoryItemRecord, filter: Filter): boolean {
  if (filter === "low") return item.is_low_stock;
  if (filter === "active") return item.is_active;
  if (filter === "inactive") return !item.is_active;
  return true;
}

const columns: ColumnDef<InventoryItemRecord, unknown>[] = [
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Item",
    cell: ({ row }) => (
      <Link
        href={`/inventory/${row.original.id}`}
        className="font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "quantity_on_hand",
    header: "On hand",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {formatQty(row.original.quantity_on_hand, row.original.unit)}
        {row.original.is_low_stock ? (
          <TriangleAlert aria-hidden className="size-3.5 text-warning" />
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "reorder_level",
    header: "Reorder at",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.reorder_level}</span>
    ),
  },
  {
    id: "value",
    header: "Value",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatMoney(row.original.stock_value, row.original.currency)}
      </span>
    ),
  },
  {
    id: "status",
    header: "",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.is_active ? null : <Badge variant="secondary">Inactive</Badge>,
  },
];

export function ItemsTable({ items }: { items: InventoryItemRecord[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = items.filter((item) => match(item, filter));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
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
        getRowId={(item) => item.id}
        empty={{
          icon: Boxes,
          title: items.length === 0 ? "No items yet" : "Nothing in this view",
          description:
            items.length === 0
              ? "Add an item to start tracking its stock level, receipts, and issues."
              : "No items match this filter. Try another.",
        }}
      />
    </section>
  );
}

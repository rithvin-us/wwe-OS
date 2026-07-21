"use client";

import { Boxes, Search } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { DataTable } from "@bop/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { formatMoney, formatQty, type InventoryItemRecord } from "@/lib/inventory-constants";

type Filter = "all" | "active" | "inactive";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

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
      <span className="inline-flex items-center gap-1.5 tabular-nums font-medium">
        {formatQty(row.original.quantity_on_hand, row.original.unit)}
      </span>
    ),
  },

  {
    id: "value",
    header: "Value",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums font-mono text-xs">
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = items.filter((item) => {
    if (filter === "active" && !item.is_active) return false;
    if (filter === "inactive" && item.is_active) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      if (!matchName && !matchSku) return false;
    }

    return true;
  });

  return (
    <section className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory by item name or SKU..."
            className="pl-9 h-9 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? "secondary" : "ghost"}
              className="h-8 text-xs px-2.5"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
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
              : "No items match your search or filter. Try clearing them.",
        }}
      />
    </section>
  );
}

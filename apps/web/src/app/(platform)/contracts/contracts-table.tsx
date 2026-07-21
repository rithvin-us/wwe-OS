"use client";

import { Download, FileSignature, TriangleAlert } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import {
  type ContractRecord,
  type ContractStatus,
  formatDate,
  formatMoney,
} from "@/lib/contracts-constants";

const STATUS_FILTERS: { value: ContractStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

function StatusBadge({ contract }: { contract: ContractRecord }) {
  if (contract.status === "active") return <Badge variant="success">{contract.status_label}</Badge>;
  if (contract.status === "in_review")
    return <Badge variant="warning">{contract.status_label}</Badge>;
  if (contract.status === "expired")
    return <Badge variant="destructive">{contract.status_label}</Badge>;
  if (contract.status === "terminated")
    return <Badge variant="secondary">{contract.status_label}</Badge>;
  return <Badge variant="outline">{contract.status_label}</Badge>;
}

const columns: ColumnDef<ContractRecord, unknown>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link
        href={`/contracts/${row.original.id}`}
        className="font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "counterparty",
    header: "Counterparty",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.counterparty}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge contract={row.original} />,
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatMoney(row.original.value, row.original.currency)}</span>
    ),
  },
  {
    accessorKey: "end_date",
    header: "Ends",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {formatDate(row.original.end_date)}
        {row.original.is_expiring_soon ? (
          <TriangleAlert aria-hidden className="size-3.5 text-warning" />
        ) : null}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.file_name ? (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/contracts/${row.original.id}/download`}>
              <Download aria-hidden />
              File
            </a>
          </Button>
        </div>
      ) : null,
  },
];

export function ContractsTable({ contracts }: { contracts: ContractRecord[] }) {
  const [filter, setFilter] = useState<ContractStatus | "all">("all");
  const rows = filter === "all" ? contracts : contracts.filter((c) => c.status === filter);

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
        getRowId={(contract) => contract.id}
        empty={{
          icon: FileSignature,
          title: contracts.length === 0 ? "No contracts yet" : "Nothing in this view",
          description:
            contracts.length === 0
              ? "Add a contract to track its dates, route it for approval, and get renewal reminders."
              : "No contracts match this filter. Try another.",
        }}
      />
    </section>
  );
}

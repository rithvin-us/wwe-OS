"use client";

import { Download, FileText, Sparkles } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import type { DocumentRecord, DocumentStatus } from "@/lib/dms-constants";

const STATUS_FILTERS: { value: DocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "archived", label: "Archived" },
];

function StatusBadge({ document }: { document: DocumentRecord }) {
  if (document.status === "approved")
    return <Badge variant="success">{document.status_label}</Badge>;
  if (document.status === "in_review")
    return <Badge variant="warning">{document.status_label}</Badge>;
  if (document.status === "archived")
    return <Badge variant="secondary">{document.status_label}</Badge>;
  return <Badge variant="outline">{document.status_label}</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const columns: ColumnDef<DocumentRecord, unknown>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link
        href={`/dms/${row.original.id}`}
        className="font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.original.title}
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
    cell: ({ row }) => <StatusBadge document={row.original} />,
  },
  {
    id: "summary",
    header: "Summary",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.summary_status === "ready" ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles aria-hidden className="size-3" />
          Ready
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "created_at",
    header: "Added",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" asChild>
          <a href={`/api/dms/${row.original.id}/download`}>
            <Download aria-hidden />
            Download
          </a>
        </Button>
      </div>
    ),
  },
];

export function DocumentsTable({ documents }: { documents: DocumentRecord[] }) {
  const [filter, setFilter] = useState<DocumentStatus | "all">("all");
  const rows = filter === "all" ? documents : documents.filter((d) => d.status === filter);

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
        getRowId={(document) => document.id}
        empty={{
          icon: FileText,
          title: documents.length === 0 ? "No documents yet" : "Nothing in this view",
          description:
            documents.length === 0
              ? "Upload a file to store it, summarize it, and route it for approval."
              : "No documents match this filter. Try another.",
        }}
      />
    </section>
  );
}

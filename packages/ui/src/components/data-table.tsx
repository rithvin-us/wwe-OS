"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bop/ui/components/table";
import { cn } from "@bop/ui/lib/utils";

/**
 * The one table component. Sticky header, sortable columns, a real empty
 * state (not a spinner, not "no data") — every table in the platform uses
 * this instead of hand-rolling `<table>` markup per screen. Column
 * resize/pin and multi-row bulk actions are deliberately not in v1 — add
 * them when a real screen needs them, not speculatively.
 */
export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Shown when `data` is empty — see @bop/ui/components/empty-state. */
  empty: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  /** Row identity for TanStack Table; defaults to array index. */
  getRowId?: (row: TData) => string;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  empty,
  getRowId,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  if (data.length === 0) {
    const Icon = empty.icon;
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-14 text-center">
        {Icon ? <Icon aria-hidden className="mb-1 size-5 text-muted-foreground" /> : null}
        <p className="text-sm font-medium text-foreground">{empty.title}</p>
        {empty.description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{empty.description}</p>
        ) : null}
        {empty.action ? <div className="mt-2">{empty.action}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("max-h-[70vh] overflow-auto rounded-lg border border-border", className)}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sortState = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className="h-10 bg-card font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortState === "asc" ? (
                          <ArrowUp aria-hidden className="size-3" />
                        ) : sortState === "desc" ? (
                          <ArrowDown aria-hidden className="size-3" />
                        ) : (
                          <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { Download, Eye, FileText, Folder, Search, Sparkles, Trash2 } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { DataTable } from "@bop/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { TagPill } from "@bop/ui/components/tag-pill";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteDocumentAction } from "@/app/(platform)/dms/actions";
import {
  DOCUMENT_CATEGORIES,
  formatFileSize,
  type DocumentCategory,
  type DocumentRecord,
  type DocumentStatus,
} from "@/lib/dms-constants";

const STATUS_FILTERS: { value: DocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

function StatusBadge({ document }: { document: DocumentRecord }) {
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

function isPreviewableInline(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

function PreviewDialog({
  document,
  onOpenChange,
}: {
  document: DocumentRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const previewUrl = document ? `/api/dms/${document.id}/download?inline=1` : "";
  const previewable = document ? isPreviewableInline(document.content_type) : false;

  return (
    <Dialog open={!!document} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{document?.title}</DialogTitle>
          <DialogDescription>
            {document?.file_name} · {document ? formatFileSize(document.file_size) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/20">
          {!document ? null : document.content_type.startsWith("image/") ? (
            <div className="flex h-full items-center justify-center overflow-auto p-2">
              <img
                src={previewUrl}
                alt={document.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : previewable ? (
            <iframe src={previewUrl} title={document.title} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                This file type ({document.content_type || "unknown"}) can&apos;t be previewed
                inline. Download it to view the contents.
              </p>
              <Button size="sm" variant="secondary" asChild>
                <a href={`/api/dms/${document.id}/download`}>
                  <Download aria-hidden />
                  Download
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  document,
  onOpenChange,
  onDeleted,
}: {
  document: DocumentRecord | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!document) return;
    startTransition(async () => {
      const res = await deleteDocumentAction(document.id);
      if (res.ok) {
        toast.success(`Deleted "${document.title}"`);
        onDeleted(document.id);
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to delete document.");
      }
    });
  }

  return (
    <Dialog open={!!document} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{document?.title}</strong>? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildColumns(
  onPreview: (document: DocumentRecord) => void,
  onDeleteRequest: (document: DocumentRecord) => void,
): ColumnDef<DocumentRecord, unknown>[] {
  return [
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
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <Sparkles aria-hidden className="size-3" />
            Ready
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "tags",
      header: "Tags",
      enableSorting: false,
      cell: ({ row }) => {
        const tags = row.original.tags;
        if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        const shown = tags.slice(0, 2);
        const overflow = tags.length - shown.length;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
            {overflow > 0 ? (
              <span className="text-xs text-muted-foreground">+{overflow}</span>
            ) : null}
          </div>
        );
      },
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
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onPreview(row.original)}>
            <Eye aria-hidden />
            Preview
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/dms/${row.original.id}/download`}>
              <Download aria-hidden />
              Download
            </a>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDeleteRequest(row.original)}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      ),
    },
  ];
}

export function DocumentsTable({ documents }: { documents: DocumentRecord[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [aiFilter, setAiFilter] = useState<"all" | "ready" | "pending">("all");
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentRecord | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const columns = useMemo(() => buildColumns(setPreviewDoc, setDeleteDoc), []);

  const rows = documents
    .filter((d) => !deletedIds.includes(d.id))
    .filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (aiFilter === "ready" && d.summary_status !== "ready") return false;
      if (aiFilter === "pending" && d.summary_status === "ready") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = d.title.toLowerCase().includes(q);
        const matchDesc = (d.description || "").toLowerCase().includes(q);
        const matchFile = (d.file_name || "").toLowerCase().includes(q);
        const matchSummary = (d.ai_summary || "").toLowerCase().includes(q);
        const matchTags = d.tags.some((tag) => tag.name.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchFile && !matchSummary && !matchTags) return false;
      }

      return true;
    });

  function handleDeleted(id: string) {
    setDeletedIds((prev) => [...prev, id]);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      {/* Interactive Filters Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents by title, tags, or text..."
            className="pl-9 h-9 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | "all")}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Categories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* AI Filter */}
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value as "all" | "ready" | "pending")}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All AI States</option>
            <option value="ready">AI Summarized Only</option>
            <option value="pending">Pending AI Summary</option>
          </select>

          {/* Status Buttons */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            {STATUS_FILTERS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={statusFilter === option.value ? "secondary" : "ghost"}
                className="h-8 text-xs px-2.5"
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(document) => document.id}
        empty={{
          icon: Folder,
          title: documents.length === 0 ? "No documents yet" : "Nothing in this view",
          description:
            documents.length === 0
              ? "Upload a file to store it, summarize it, and track company documents."
              : "No documents match your search or filters. Try clearing some filters.",
        }}
      />

      <PreviewDialog document={previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)} />
      <DeleteConfirmDialog
        document={deleteDoc}
        onOpenChange={(open) => !open && setDeleteDoc(null)}
        onDeleted={handleDeleted}
      />
    </section>
  );
}

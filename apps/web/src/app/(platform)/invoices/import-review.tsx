"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

import type {
  BillingCustomer,
  ImportBatchDetail,
  ImportDraft,
  ImportDraftLine,
  ImportItem,
  ImportItemStatus,
} from "@/config/invoices";
import {
  IMPORT_CONFIDENCE_OK,
  IMPORT_ITEM_BADGE_VARIANTS,
  IMPORT_ITEM_STATUS_LABELS,
  emptyLine,
  formatRupees,
  importScanUrl,
  toImportDraft,
} from "@/config/invoices";

const PROCESSING: ImportItemStatus[] = ["queued", "processing"];
const REVIEWABLE: ImportItemStatus[] = ["extracted", "needs_attention"];

function unwrap<T>(json: unknown): T {
  return (json as { data?: T })?.data ?? (json as T);
}

export function ImportReview({
  initialBatch,
  customers,
}: {
  initialBatch: ImportBatchDetail;
  customers: BillingCustomer[];
}) {
  const [items, setItems] = useState<ImportItem[]>(initialBatch.items);
  const [committingAll, setCommittingAll] = useState(false);

  const anyProcessing = items.some((item) => PROCESSING.includes(item.status));

  const replaceItem = useCallback((updated: ImportItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/invoice-imports/${initialBatch.id}`);
      if (!res.ok) return;
      const fresh = unwrap<ImportBatchDetail>(await res.json());
      // Never clobber a row the operator has already moved on from — only rows
      // still being read take the fresh copy.
      setItems((prev) =>
        fresh.items.map((freshItem) => {
          const local = prev.find((p) => p.id === freshItem.id);
          if (local && !PROCESSING.includes(local.status)) return local;
          return freshItem;
        }),
      );
    } catch {
      /* transient — the next poll retries */
    }
  }, [initialBatch.id]);

  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(refetch, 3000);
    return () => clearInterval(timer);
  }, [anyProcessing, refetch]);

  const counts = useMemo(() => {
    const by = (status: ImportItemStatus) => items.filter((i) => i.status === status).length;
    return {
      total: items.length,
      reading: by("queued") + by("processing"),
      review: by("extracted") + by("needs_attention"),
      committed: by("committed"),
      failed: by("failed"),
    };
  }, [items]);

  const readyToCommit = items.filter((i) => REVIEWABLE.includes(i.status)).length;

  async function commitAll() {
    setCommittingAll(true);
    try {
      const res = await fetch(`/api/finance/invoice-imports/${initialBatch.id}/commit/`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not commit the batch.");
        return;
      }
      const result = unwrap<{ committed: unknown[]; failed: unknown[] }>(json);
      const done = result.committed?.length ?? 0;
      const failed = result.failed?.length ?? 0;
      if (done > 0)
        toast.success(`Committed ${done} invoice${done === 1 ? "" : "s"} to the register.`);
      if (failed > 0) toast.error(`${failed} could not be committed — check the flagged rows.`);
      await refetch();
    } catch {
      toast.error("Could not commit the batch. Try again.");
    } finally {
      setCommittingAll(false);
    }
  }

  const allDone = counts.total > 0 && counts.reading === 0 && counts.review === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/invoices/import"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All imports
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {initialBatch.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              {counts.total} invoice{counts.total === 1 ? "" : "s"}
              {counts.reading > 0 ? ` · ${counts.reading} reading` : ""}
              {counts.review > 0 ? ` · ${counts.review} to review` : ""}
              {counts.committed > 0 ? ` · ${counts.committed} committed` : ""}
              {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allDone ? (
              <Button asChild variant="outline">
                <Link href="/invoices">View register</Link>
              </Button>
            ) : null}
            <Button onClick={commitAll} disabled={committingAll || readyToCommit === 0}>
              {committingAll ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Commit {readyToCommit || "all"} ready
            </Button>
          </div>
        </div>
      </div>

      {counts.reading > 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Reading {counts.reading} scan{counts.reading === 1 ? "" : "s"} — this page updates as each
          finishes.
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) =>
          PROCESSING.includes(item.status) ? (
            <ProcessingCard key={item.id} item={item} />
          ) : (
            <ItemCard key={item.id} item={item} customers={customers} onChange={replaceItem} />
          ),
        )}
      </ul>
    </div>
  );
}

function ProcessingCard({ item }: { item: ImportItem }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-xs">
      <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-primary" />
      <span className="min-w-0 flex-1 truncate text-foreground">{item.original_filename}</span>
      <Badge variant={IMPORT_ITEM_BADGE_VARIANTS[item.status]}>
        {IMPORT_ITEM_STATUS_LABELS[item.status]}
      </Badge>
    </li>
  );
}

function ItemCard({
  item,
  customers,
  onChange,
}: {
  item: ImportItem;
  customers: BillingCustomer[];
  onChange: (item: ImportItem) => void;
}) {
  const [draft, setDraft] = useState<ImportDraft>(() => toImportDraft(item.proposed));
  const [total, setTotal] = useState<string>(item.proposed_total);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

  const committed = item.status === "committed";
  const discarded = item.status === "discarded";
  const failed = item.status === "failed";
  const locked = committed || discarded || saving || committing;
  const confidence = Number.parseFloat(item.confidence_score || "0");

  function set<K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function setLine(index: number, key: keyof ImportDraftLine, value: string) {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));
    setDirty(true);
  }

  function addLine() {
    setDraft((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
    setDirty(true);
  }

  function removeLine(index: number) {
    setDraft((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
    setDirty(true);
  }

  async function save(): Promise<ImportItem | null> {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/invoice-import-items/${item.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save your changes.");
        return null;
      }
      const updated = unwrap<ImportItem>(json);
      setTotal(updated.proposed_total);
      setDirty(false);
      onChange(updated);
      return updated;
    } catch {
      toast.error("Could not save your changes. Try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function commit() {
    setCommitting(true);
    try {
      // Commit always reflects the latest edits, so save first.
      if (dirty && !(await save())) return;
      const res = await fetch(`/api/finance/invoice-import-items/${item.id}/commit/`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not commit this invoice.");
        return;
      }
      const invoice = unwrap<{ id: string; number: string }>(json);
      toast.success(`Invoice ${invoice.number} added to the register.`);
      onChange({
        ...item,
        status: "committed",
        invoice: invoice.id,
        invoice_number: invoice.number,
      });
    } catch {
      toast.error("Could not commit this invoice. Try again.");
    } finally {
      setCommitting(false);
    }
  }

  async function discard() {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/invoice-import-items/${item.id}/discard/`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not discard this item.");
        return;
      }
      onChange(unwrap<ImportItem>(json));
      toast.success("Removed from the batch.");
    } catch {
      toast.error("Could not discard this item. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {!committed && !discarded ? <ConfidenceRing score={confidence} /> : null}
          <div className="min-w-0 space-y-1">
            <a
              href={importScanUrl(item.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              <span className="max-w-[16rem] truncate">{item.original_filename}</span>
              <ExternalLink aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={IMPORT_ITEM_BADGE_VARIANTS[item.status]}>
                {IMPORT_ITEM_STATUS_LABELS[item.status]}
              </Badge>
              {committed && item.invoice_number ? (
                <span className="text-xs text-muted-foreground">as {item.invoice_number}</span>
              ) : null}
            </div>
          </div>
        </div>
        {!committed && !discarded ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatRupees(total)}
            </p>
            {dirty ? <p className="text-[11px] text-warning">unsaved — save to update</p> : null}
          </div>
        ) : null}
      </div>

      {failed && item.error_message ? (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {item.error_message}
        </p>
      ) : null}

      {committed ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 aria-hidden className="size-4" />
          Committed to the register{item.invoice_number ? ` as ${item.invoice_number}` : ""}.
        </p>
      ) : discarded ? (
        <p className="text-sm text-muted-foreground">Removed from this batch.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Invoice number">
              <Input
                value={draft.number}
                onChange={(e) => set("number", e.target.value)}
                placeholder="G/M/12/2026-27"
                disabled={locked}
              />
            </Field>
            <Field label="Invoice date">
              <Input
                type="date"
                value={draft.invoice_date}
                onChange={(e) => set("invoice_date", e.target.value)}
                disabled={locked}
              />
            </Field>
            <Field label="Type">
              <NativeSelect
                value={draft.invoice_type}
                onChange={(v) => set("invoice_type", v as ImportDraft["invoice_type"])}
                disabled={locked}
              >
                <option value="sales">Sales</option>
                <option value="amc">AMC</option>
              </NativeSelect>
            </Field>
            <Field label="Customer">
              <NativeSelect
                value={draft.customer_id ?? ""}
                onChange={(v) => set("customer_id", v || null)}
                disabled={locked}
              >
                <option value="">— One-off (no master) —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Billed to (consignee)">
              <Input
                value={draft.consignee_name}
                onChange={(e) => set("consignee_name", e.target.value)}
                disabled={locked}
              />
            </Field>
            <Field label="GSTIN">
              <Input
                value={draft.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                disabled={locked}
              />
            </Field>
            <Field label="GST rate %">
              <Input
                value={draft.gst_rate}
                onChange={(e) => set("gst_rate", e.target.value)}
                inputMode="decimal"
                disabled={locked}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.is_sez}
                onChange={(e) => set("is_sez", e.target.checked)}
                disabled={locked}
                className="size-4 rounded border-input"
              />
              SEZ supply (IGST)
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Line items</p>
            <div className="space-y-2">
              {draft.lines.map((line, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[10rem] flex-1"
                    value={line.description}
                    onChange={(e) => setLine(index, "description", e.target.value)}
                    placeholder="Description"
                    disabled={locked}
                  />
                  <Input
                    className="w-24"
                    value={line.hsn}
                    onChange={(e) => setLine(index, "hsn", e.target.value)}
                    placeholder="HSN"
                    disabled={locked}
                  />
                  <Input
                    className="w-16"
                    value={line.quantity}
                    onChange={(e) => setLine(index, "quantity", e.target.value)}
                    placeholder="Qty"
                    inputMode="decimal"
                    disabled={locked}
                  />
                  <Input
                    className="w-16"
                    value={line.uom}
                    onChange={(e) => setLine(index, "uom", e.target.value)}
                    placeholder="Nos"
                    disabled={locked}
                  />
                  <Input
                    className="w-28"
                    value={line.rate}
                    onChange={(e) => setLine(index, "rate", e.target.value)}
                    placeholder="Rate"
                    inputMode="decimal"
                    disabled={locked}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={locked || draft.lines.length === 1}
                    className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    aria-label="Remove line"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={addLine} disabled={locked}>
              <Plus aria-hidden className="size-4" />
              Add line
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={discard} disabled={locked}>
              Discard
            </Button>
            <Button variant="outline" size="sm" onClick={save} disabled={locked || !dirty}>
              {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" onClick={commit} disabled={locked}>
              {committing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Commit to register
            </Button>
          </div>
        </>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function ConfidenceRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, score)));
  const tone = score >= IMPORT_CONFIDENCE_OK ? "var(--success)" : "var(--warning)";

  return (
    <div
      className="relative flex size-12 shrink-0 items-center justify-center"
      title={`OCR confidence ${pct}%`}
    >
      <svg viewBox="0 0 52 52" className="size-12 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ScanText, TriangleAlert } from "@bop/icons";
import { Dropzone } from "@bop/ui/components/dropzone";
import { cn } from "@bop/ui/lib/utils";
import { toast } from "sonner";

import { SectionCard } from "@/components/dashboard/section-card";

interface IngestResult {
  seller_name: string;
  invoice_number: string;
  total_rate: string;
  currency: string;
  confidence_score: number;
}

function ConfidenceRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);
  const tone = score >= 0.8 ? "var(--success)" : "var(--warning)";

  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 52 52" className="size-14 -rotate-90">
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
          className="transition-[stroke-dashoffset] duration-(--duration-slow) ease-out-expo"
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-bold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

export function PurchaseUploadCard() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [result, setResult] = useState<IngestResult | null>(null);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setStatus("scanning");
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/purchase/bills/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(
          data?.message || `Upload failed (HTTP ${response.status}). Check your connection.`,
        );
        setStatus("idle");
        return;
      }
      setResult(data as IngestResult);
      setStatus("done");
      toast.success("Bill scanned and added to Purchases.");
      router.refresh();
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <SectionCard title="Scan a bill" icon={ScanText}>
      {status === "idle" ? (
        <Dropzone
          onFiles={handleFiles}
          accept="image/*,.pdf"
          maxSizeBytes={8 * 1024 * 1024}
          label="Drop a bill photo or PDF, or click to browse"
          hint="Vendor, GSTIN, and line items are extracted automatically"
        />
      ) : null}

      {status === "scanning" ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="relative flex size-10 items-center justify-center">
            <ScanText aria-hidden className="size-6 text-primary" />
            <span className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Scanning bill…</p>
          <p className="text-xs text-muted-foreground">Reading vendor, GSTIN, and totals</p>
        </div>
      ) : null}

      {status === "done" && result ? (
        <div className="flex items-start gap-3 py-2">
          <ConfidenceRing score={result.confidence_score} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              {result.confidence_score >= 0.8 ? (
                <CheckCircle2 aria-hidden className="size-3.5 text-success" />
              ) : (
                <TriangleAlert aria-hidden className="size-3.5 text-warning" />
              )}
              <span className="truncate text-sm font-medium text-foreground">
                {result.seller_name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {result.invoice_number ? `Invoice ${result.invoice_number} · ` : ""}
              {result.currency} {result.total_rate}
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className={cn(
                "rounded-sm text-xs font-medium text-primary transition-colors hover:underline",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              Scan another
            </button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

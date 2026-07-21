import { ArrowLeft, Download, Sparkles, TriangleAlert } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ContractActions } from "@/app/(platform)/contracts/[id]/contract-actions";
import { ApiRequestError } from "@/lib/api/envelope";
import { type ContractRecord, formatDate, formatMoney, getContract } from "@/lib/contracts";

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

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let contract: ContractRecord;
  try {
    contract = await getContract(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/contracts">
            <ArrowLeft aria-hidden />
            Contracts
          </Link>
        </Button>
        <PageHeader
          title={contract.title}
          description={`With ${contract.counterparty}`}
          meta={
            <div className="flex items-center gap-2">
              <StatusBadge contract={contract} />
              <Badge variant="outline" className="capitalize">
                {contract.category_label}
              </Badge>
            </div>
          }
          actions={
            <ContractActions
              id={contract.id}
              status={contract.status}
              hasFile={contract.file_name !== null}
            />
          }
        />
      </div>

      {contract.is_expiring_soon ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert aria-hidden className="size-4" />
          Renewal due — this contract ends on {formatDate(contract.end_date)} (
          {contract.days_to_expiry} days).
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles aria-hidden className="size-4 text-muted-foreground" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.summary_status === "ready" && contract.ai_summary ? (
              <p className="text-sm leading-relaxed text-foreground">{contract.ai_summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary yet. Attach the signed file or use “Regenerate summary”.
              </p>
            )}
            {contract.notes ? (
              <div className="border-t border-border pt-3">
                <p className="mb-1 font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Notes
                </p>
                <p className="text-sm text-foreground">{contract.notes}</p>
              </div>
            ) : null}
            {contract.status === "terminated" && contract.termination_reason ? (
              <div className="border-t border-border pt-3">
                <p className="mb-1 font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Termination reason
                </p>
                <p className="text-sm text-foreground">{contract.termination_reason}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <MetaRow label="Counterparty">{contract.counterparty}</MetaRow>
            <MetaRow label="Value">{formatMoney(contract.value, contract.currency)}</MetaRow>
            <MetaRow label="Starts">{formatDate(contract.start_date)}</MetaRow>
            <MetaRow label="Ends">{formatDate(contract.end_date)}</MetaRow>
            <MetaRow label="Auto-renews">{contract.auto_renew ? "Yes" : "No"}</MetaRow>
            <MetaRow label="Owner">{contract.owner_email ?? "—"}</MetaRow>
            {contract.file_name ? (
              <div className="pt-3">
                <Button variant="secondary" size="sm" asChild className="w-full">
                  <a href={`/api/contracts/${contract.id}/download`}>
                    <Download aria-hidden />
                    {contract.file_name}
                  </a>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

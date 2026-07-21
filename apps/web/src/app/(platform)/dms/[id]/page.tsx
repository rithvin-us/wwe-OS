import { ArrowLeft, Download, Sparkles } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentActions } from "@/app/(platform)/dms/[id]/document-actions";
import { ApiRequestError } from "@/lib/api/envelope";
import { formatFileSize, getDocument, type DocumentRecord } from "@/lib/dms";

function StatusBadge({ document }: { document: DocumentRecord }) {
  if (document.status === "approved")
    return <Badge variant="success">{document.status_label}</Badge>;
  if (document.status === "in_review")
    return <Badge variant="warning">{document.status_label}</Badge>;
  if (document.status === "archived")
    return <Badge variant="secondary">{document.status_label}</Badge>;
  return <Badge variant="outline">{document.status_label}</Badge>;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let document: DocumentRecord;
  try {
    document = await getDocument(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
          <Link href="/dms">
            <ArrowLeft aria-hidden />
            Documents
          </Link>
        </Button>
        <PageHeader
          title={document.title}
          description={document.description || "No description."}
          meta={
            <div className="flex items-center gap-2">
              <StatusBadge document={document} />
              <Badge variant="outline" className="capitalize">
                {document.category_label}
              </Badge>
            </div>
          }
          actions={<DocumentActions id={document.id} status={document.status} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles aria-hidden className="size-4 text-muted-foreground" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {document.summary_status === "ready" && document.ai_summary ? (
              <p className="text-sm leading-relaxed text-foreground">{document.ai_summary}</p>
            ) : document.summary_status === "failed" ? (
              <p className="text-sm text-muted-foreground">
                The summary couldn&apos;t be generated. Use “Regenerate summary” to try again.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary yet. Use “Regenerate summary” to create one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <MetaRow label="File">{document.file_name}</MetaRow>
            <MetaRow label="Size">{formatFileSize(document.file_size)}</MetaRow>
            <MetaRow label="Owner">{document.owner_email ?? "—"}</MetaRow>
            <MetaRow label="Added">
              {new Date(document.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </MetaRow>
            {document.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 py-3">
                {document.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="pt-3">
              <Button variant="secondary" size="sm" asChild className="w-full">
                <a href={`/api/dms/${document.id}/download`}>
                  <Download aria-hidden />
                  Download file
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

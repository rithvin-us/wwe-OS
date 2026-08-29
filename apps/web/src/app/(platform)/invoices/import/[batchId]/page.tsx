import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBillingCustomers, getInvoiceImport } from "@/lib/invoices";

import { ImportReview } from "../../import-review";

export const metadata: Metadata = {
  title: "Review import",
};

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, customers] = await Promise.all([getInvoiceImport(batchId), getBillingCustomers()]);
  if (!batch) notFound();

  return <ImportReview initialBatch={batch} customers={customers} />;
}

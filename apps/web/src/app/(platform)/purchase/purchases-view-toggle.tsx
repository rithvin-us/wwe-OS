"use client";

import { useState } from "react";
import { FileText, Wallet, Send } from "@bop/icons";
import { AutoRefreshPurchases } from "@/app/(platform)/purchase/auto-refresh";
import { BillsTable } from "@/app/(platform)/purchase/bills-table";
import { VendorsPanel } from "@/app/(platform)/purchase/vendors-panel";
import type { PurchaseBill, Vendor } from "@/lib/purchase";
import type { Tag } from "@/lib/tags";

export function PurchasesViewToggle({
  bills,
  vendors,
  allTags,
}: {
  bills: PurchaseBill[];
  vendors: Vendor[];
  allTags: Tag[];
}) {
  const [activeTab, setActiveTab] = useState<"bills" | "vendors">("bills");

  return (
    <div className="space-y-4 pt-2">
      {/* Segmented Control Toggle Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("bills")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === "bills"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-4" />
            Purchase Bills ({bills.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vendors")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === "vendors"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="size-4" />
            Vendors Directory ({vendors.length})
          </button>
        </div>

        {/* A "Live Sync Active" pill used to render here unconditionally. It
            was decorative — nothing measured a sync, so it claimed liveness
            whether or not ingestion was running. Removed rather than faked;
            if a real sync signal lands, surface that instead. */}
      </div>

      {/* Tab 1: Purchase Bills */}
      {activeTab === "bills" && (
        <section className="space-y-3">
          <AutoRefreshPurchases intervalMs={3000} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <Send aria-hidden className="size-3.5" />
              Send a receipt photo or PDF to the Telegram bot to digitize it automatically.
            </div>
          </div>
          <BillsTable bills={bills} allTags={allTags} />
        </section>
      )}

      {/* Tab 2: Vendors Directory */}
      {activeTab === "vendors" && (
        <section>
          <VendorsPanel vendors={vendors} />
        </section>
      )}
    </div>
  );
}

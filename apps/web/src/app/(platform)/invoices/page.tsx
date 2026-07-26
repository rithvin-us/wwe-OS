"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@bop/ui/components/page-header";
import { FileText, Plus, Download, Printer, Trash2, FileBarChart2, CheckCircle2 } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

export interface InvoiceItem {
  id: string;
  number: string;
  customer: string;
  date: string;
  amount: number;
  status: "paid" | "pending";
  receivedDate?: string;
  receivedAmount?: number;
  paymentRef?: string;
}

const INITIAL_INVOICES: InvoiceItem[] = [
  {
    id: "inv-1",
    number: "INV-2026-089",
    customer: "Waterworks Engineering Pvt Ltd",
    date: "Jul 24, 2026",
    amount: 245000,
    status: "paid",
    receivedDate: "Jul 25, 2026",
    receivedAmount: 245000,
    paymentRef: "UTR-8912049",
  },
  {
    id: "inv-2",
    number: "INV-2026-090",
    customer: "Apex Industrial Machinery",
    date: "Jul 26, 2026",
    amount: 135000,
    status: "pending",
  },
];

function formatINR(val: number): string {
  return `₹${val.toLocaleString("en-IN")}`;
}

function formatLakhs(val: number): string {
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)}L`;
  }
  return formatINR(val);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(INITIAL_INVOICES);
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // New Invoice Form state
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");

  // Mark as Paid Dialog state
  const [recvDate, setRecvDate] = useState("");
  const [recvAmount, setRecvAmount] = useState("");
  const [payRef, setPayRef] = useState("");

  function handleDelete(id: string, number: string) {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    toast.success(`Invoice ${number} deleted successfully`);
  }

  /**
   * Indian-style number formatting: 1,15,542.00 (lakhs grouping).
   * Matches the company's legal format — do NOT change.
   */
  function formatIndian(val: number, decimals = 2): string {
    const sign = val < 0 ? "-" : "";
    const abs = Math.abs(val);
    const [whole, frac] = abs.toFixed(decimals).split(".");
    if (whole.length > 3) {
      const tail = whole.slice(-3);
      let head = whole.slice(0, -3);
      const groups: string[] = [];
      while (head.length > 2) {
        groups.unshift(head.slice(-2));
        head = head.slice(0, -2);
      }
      if (head) groups.unshift(head);
      return `${sign}${groups.join(",")},${tail}.${frac}`;
    }
    return `${sign}${whole}.${frac}`;
  }

  /**
   * Convert a number to Indian words for the invoice's "In Words" line.
   * Example: 136340 → "Rupees One Lakh Thirty Six Thousand Three Hundred Forty Only"
   */
  function numberToWords(n: number): string {
    if (n === 0) return "Rupees Zero Only";
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    function twoDigits(x: number): string {
      if (x < 20) return ones[x] || "";
      return (tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "")).trim();
    }
    function threeDigits(x: number): string {
      if (x >= 100)
        return ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + twoDigits(x % 100) : "");
      return twoDigits(x);
    }

    const rounded = Math.round(n);
    const crore = Math.floor(rounded / 10000000);
    const lakh = Math.floor((rounded % 10000000) / 100000);
    const thousand = Math.floor((rounded % 100000) / 1000);
    const remainder = rounded % 1000;
    const parts: string[] = [];
    if (crore) parts.push(threeDigits(crore) + " Crore");
    if (lakh) parts.push(twoDigits(lakh) + " Lakh");
    if (thousand) parts.push(twoDigits(thousand) + " Thousand");
    if (remainder) parts.push(threeDigits(remainder));
    return "Rupees " + parts.join(" ") + " Only";
  }

  /**
   * Generates the official WATER WORKS ENGINEERING invoice HTML.
   *
   * ⚠️  RIGID LEGAL FORMAT — this layout matches the company's registered
   *     invoice template (invoice_template.xlsx) and the reportlab PDF
   *     renderer in finance/backend/services/pdf.py. Do NOT alter the
   *     structure, field order, company details, bank details, terms of
   *     sales, or declaration without legal review.
   */
  function generateInvoiceHtml(inv: InvoiceItem): string {
    const subtotal = inv.amount / 1.18;
    const igst = inv.amount - subtotal;
    const gross = subtotal + igst;
    const roundOff = Math.round(inv.amount) - inv.amount;
    const netTotal = Math.round(inv.amount);
    const invoiceDate = inv.date;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.number} - Water Works Engineering</title>
  <style>
    @media print { @page { size: A4; margin: 10mm; } body { margin: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11px; color: #000; padding: 20px; max-width: 210mm; margin: 0 auto; line-height: 1.35; }
    table { border-collapse: collapse; width: 100%; }
    td, th { padding: 3px 5px; vertical-align: top; }

    /* --- Master wrapper: thick outer frame --- */
    .invoice-frame { border: 1.5px solid #000; }
    .invoice-frame > tbody > tr > td,
    .invoice-frame > tbody > tr > th { border: 0.5px solid #000; }

    /* Nested tables inside header/consignee/footer: no borders at all */
    .invoice-frame table { border: none; }
    .invoice-frame table td,
    .invoice-frame table th { border: none; }

    /* Header: seller + invoice meta */
    .hdr-left { width: 55%; font-size: 10.5px; }
    .hdr-right { width: 45%; font-size: 10.5px; }
    .company-name { font-size: 13px; font-weight: bold; }
    .hdr-right td { padding: 2px 5px; }
    .hdr-left td { padding: 1px 5px; }

    /* Consignee */
    .consignee td { padding: 1px 5px; font-size: 10.5px; }

    /* Items table */
    .items th { text-align: center; font-weight: bold; font-size: 10px; padding: 4px 3px; background: transparent; }
    .items td { font-size: 10.5px; padding: 3px 4px; }
    .items .num { text-align: right; font-family: 'Courier New', monospace; }
    .items .ctr { text-align: center; }

    /* Totals */
    .totals-label { text-align: right; font-weight: normal; }
    .totals-value { text-align: right; font-family: 'Courier New', monospace; }
    .net-total .totals-label, .net-total .totals-value { font-weight: bold; }

    /* Words */
    .words td { font-size: 10.5px; padding: 3px 5px; }
    .words-heading { font-weight: bold; font-size: 10px; }

    /* Footer: bank + terms + declaration + signatory */
    .footer-block td { font-size: 9.5px; padding: 2px 5px; vertical-align: top; }
    .footer-heading { font-weight: bold; font-size: 10px; }
    .declaration { font-style: italic; font-size: 9px; }
    .signatory { text-align: right; padding-top: 25px !important; font-size: 10px; }
  </style>
</head>
<body>
  <table class="invoice-frame">
    <!-- ============ HEADER ROW ============ -->
    <tr>
      <td class="hdr-left" colspan="6">
        <table style="width:100%; border:none;">
          <tr><td colspan="2" style="padding-bottom:2px;">
            <span class="company-name">WATER WORKS ENGINEERING</span><br>
            65 - B, Gurusamy Nagar,<br>
            Thanneerpandal,<br>
            Peelamedu, Coimbatore -641 004.<br>
            Tamil Nadu, +91 98650 13678, 99427 44822 E Mail :<br>
            waterworksengineeringcbe@gmail.com<br>
            <b>GST : 33AABFW6153H1Z8</b>
          </td></tr>
        </table>
      </td>
      <td class="hdr-right" colspan="5">
        <table style="width:100%; border:none;">
          <tr><td><b>Invoice No.:</b> ${inv.number}</td></tr>
          <tr><td><b>Date :</b> ${invoiceDate}</td></tr>
          <tr><td>&nbsp;</td></tr>
          <tr><td><b>Buyer Order No. &amp; Date :</b></td></tr>
          <tr><td><b>Facility:</b> ${inv.customer}</td></tr>
          <tr><td><b>Mode of Transport:</b></td></tr>
        </table>
      </td>
    </tr>

    <!-- ============ CONSIGNEE ============ -->
    <tr>
      <td colspan="11" style="padding: 3px 5px;">
        <table class="consignee" style="width:100%; border:none;">
          <tr><td><b>Consignee :</b></td></tr>
          <tr><td>${inv.customer}</td></tr>
          <tr><td>CBE</td></tr>
          <tr><td><b>GSTIN :</b></td></tr>
        </table>
      </td>
    </tr>

    <!-- ============ ITEMS HEADER ============ -->
    <tr class="items">
      <th style="width:6%;">S.No.</th>
      <th style="width:32%;" colspan="2">Description</th>
      <th style="width:10%;">HSN</th>
      <th style="width:10%;">Quantity</th>
      <th style="width:8%;">UOM</th>
      <th style="width:14%;">Rate</th>
      <th style="width:14%;" colspan="4">Value</th>
    </tr>

    <!-- Period line (month) -->
    <tr class="items">
      <td></td>
      <td colspan="2"><b>For the month of ${inv.date}</b></td>
      <td></td><td></td><td></td><td></td><td colspan="4"></td>
    </tr>

    <!-- Line item row -->
    <tr class="items">
      <td class="ctr">1</td>
      <td colspan="2">AMC CHARGES</td>
      <td></td>
      <td class="num">1</td>
      <td class="ctr">Nos</td>
      <td class="num">${formatIndian(subtotal)}</td>
      <td class="num" colspan="4">${formatIndian(subtotal)}</td>
    </tr>

    <!-- Blank spacer rows to match form height -->
    <tr class="items"><td>&nbsp;</td><td colspan="2"></td><td></td><td></td><td></td><td></td><td colspan="4"></td></tr>
    <tr class="items"><td></td><td colspan="2"></td><td></td><td></td><td></td><td></td><td colspan="4"></td></tr>
    <tr class="items"><td></td><td colspan="2"></td><td></td><td></td><td></td><td></td><td colspan="4"></td></tr>

    <!-- IGST -->
    <tr class="items">
      <td></td><td colspan="2"></td><td></td><td></td><td></td>
      <td class="totals-label">IGST 18%</td>
      <td class="totals-value" colspan="4">${formatIndian(igst)}</td>
    </tr>

    <!-- Total -->
    <tr class="items">
      <td></td><td colspan="2"></td><td></td><td></td><td></td>
      <td class="totals-label">Total</td>
      <td class="totals-value" colspan="4">${formatIndian(gross)}</td>
    </tr>

    <!-- R/OFF -->
    <tr class="items">
      <td></td><td colspan="2"></td><td></td><td></td><td></td>
      <td class="totals-label">R/OFF</td>
      <td class="totals-value" colspan="4">${formatIndian(roundOff)}</td>
    </tr>

    <!-- NET TOTAL -->
    <tr class="items net-total">
      <td></td><td colspan="2"></td><td></td><td></td><td></td>
      <td class="totals-label"><b>NET TOTAL :</b></td>
      <td class="totals-value" colspan="4"><b>${formatIndian(netTotal)}</b></td>
    </tr>

    <!-- ============ AMOUNT IN WORDS ============ -->
    <tr class="words">
      <td colspan="11"><span class="words-heading">( In Words )</span></td>
    </tr>
    <tr class="words">
      <td colspan="11">${numberToWords(netTotal)}</td>
    </tr>

    <!-- ============ BANK + TERMS ============ -->
    <tr>
      <td colspan="6" class="footer-block" rowspan="2">
        <span class="footer-heading">Bank Details for RTGS / NEFT :</span><br>
        Bank Name HDFC<br>
        Branch Kalapatti Main Road<br>
        A/C No. 50200001403722<br>
        IFSC Code HDFC0001068<br><br>
        <span class="footer-heading">Declaration:</span><br>
        <span class="declaration">We declare that this invoice shows the actual price of the goods described and<br>
        that all particulars are true and correct.</span>
      </td>
      <td colspan="5" class="footer-block">
        <span class="footer-heading">Terms of Sales:</span><br>
        1. Seller is not responsible for any loss or damage of goods in transit<br>
        2. Dispute if any, will be subject to sellers Court Jurisdiction at Coimbatore
      </td>
    </tr>
    <tr>
      <td colspan="5" class="footer-block signatory">
        <b>For WATER WORKS ENGINEERING</b><br><br><br><br>
        Authorized Signatory
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  function handleDownloadInvoice(inv: InvoiceItem) {
    const htmlContent = generateInvoiceHtml(inv);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}_Invoice.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${inv.number} invoice file!`);
  }

  function handlePrintInvoice(inv: InvoiceItem) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups in your browser to print invoices.");
      return;
    }
    printWindow.document.write(generateInvoiceHtml(inv));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.trim() || !amount) {
      toast.error("Please fill in customer name and amount.");
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const newNumber = `INV-2026-0${91 + invoices.length}`;
    const newDoc: InvoiceItem = {
      id: `inv-${Date.now()}`,
      number: newNumber,
      customer: customer.trim(),
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
      amount: numAmount,
      status: "pending",
    };

    setInvoices((prev) => [newDoc, ...prev]);
    setCustomer("");
    setAmount("");
    setOpenNewDialog(false);
    toast.success(`Invoice ${newNumber} generated (Pending payment).`);
  }

  function openMarkPaid(inv: InvoiceItem) {
    setSelectedInvoice(inv);
    setRecvDate(new Date().toISOString().split("T")[0]);
    setRecvAmount(inv.amount.toString());
    setPayRef("");
  }

  function handleConfirmMarkPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!recvDate || !recvAmount) {
      toast.error("Please enter the receiving date and received amount.");
      return;
    }

    const numRecv = parseFloat(recvAmount) || 0;
    const formattedDate = new Date(recvDate).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === selectedInvoice.id
          ? {
              ...inv,
              status: "paid",
              receivedDate: formattedDate,
              receivedAmount: numRecv,
              paymentRef: payRef.trim(),
            }
          : inv,
      ),
    );

    toast.success(
      `Invoice ${selectedInvoice.number} converted to PAID! Received ${formatINR(numRecv)} on ${formattedDate}.`,
    );
    setSelectedInvoice(null);
  }

  // Calculate totals
  const totalAmount = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const pendingAmount = invoices
    .filter((inv) => inv.status === "pending")
    .reduce((acc, inv) => acc + inv.amount, 0);
  const pendingCount = invoices.filter((inv) => inv.status === "pending").length;
  const paidAmount = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((acc, inv) => acc + (inv.receivedAmount || inv.amount), 0);
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="In-house invoice generation, customer billing, and sales records."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/invoices/register">Bill register</Link>
            </Button>
            <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                >
                  <Plus className="size-4" /> Generate New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateInvoice}>
                  <DialogHeader>
                    <DialogTitle>Generate New Invoice</DialogTitle>
                    <DialogDescription>
                      Create an in-house sales invoice for customer billing.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 text-xs">
                    <div className="grid gap-1.5">
                      <Label htmlFor="customer">Customer / Client Name</Label>
                      <Input
                        id="customer"
                        placeholder="e.g. Acme Corporation"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="amount">Invoice Amount (INR)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="e.g. 150000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpenNewDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Create Invoice
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Generated Invoices</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-foreground mt-1">
            {formatLakhs(totalAmount)}
          </h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {invoices.length} Invoices generated this month
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Pending Payments</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-1">
            {formatLakhs(pendingAmount)}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            {pendingCount} Invoices pending customer clearance
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Paid & Settled</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
            {formatLakhs(paidAmount)}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            {paidCount} Invoices settled in full
          </p>
        </div>
      </div>

      {/* Mark as Paid Dialog Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleConfirmMarkPaid}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" /> Record Payment & Mark Paid
              </DialogTitle>
              <DialogDescription>
                Convert status for{" "}
                <strong className="text-foreground">{selectedInvoice?.number}</strong> (
                {selectedInvoice?.customer}) to PAID.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-xs">
              <div className="grid gap-1.5">
                <Label htmlFor="recvDate">Receiving Date</Label>
                <Input
                  id="recvDate"
                  type="date"
                  value={recvDate}
                  onChange={(e) => setRecvDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recvAmount">Received Amount (INR)</Label>
                <Input
                  id="recvAmount"
                  type="number"
                  placeholder="e.g. 135000"
                  value={recvAmount}
                  onChange={(e) => setRecvAmount(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="payRef">Payment Reference / UTR / Cheque (Optional)</Label>
                <Input
                  id="payRef"
                  placeholder="e.g. UTR-9823019 or HDFC Cheque #1029"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedInvoice(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm & Mark Paid
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generated Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">In-house Invoices Log</h4>
            <p className="text-xs text-muted-foreground">Generated invoices for client billing</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => toast.info("Exporting invoice log...")}
            >
              <Download className="size-3.5" /> Export Summary
            </Button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-2">
            <FileBarChart2 className="size-8 text-muted-foreground/50" />
            <h4 className="text-sm font-medium text-foreground">No invoices generated yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Click &quot;Generate New Invoice&quot; above to create your first in-house sales
              invoice.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left font-mono uppercase text-[10px] text-muted-foreground">
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Customer / Client</th>
                  <th className="p-3 font-semibold">Invoice Date</th>
                  <th className="p-3 font-semibold text-right">Amount</th>
                  <th className="p-3 font-semibold">Status & Payment Info</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-foreground flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                      {inv.number}
                    </td>
                    <td className="p-3 font-medium text-foreground">{inv.customer}</td>
                    <td className="p-3 text-muted-foreground font-mono">{inv.date}</td>
                    <td className="p-3 text-right font-mono font-semibold text-foreground">
                      {formatINR(inv.amount)}
                    </td>
                    <td className="p-3">
                      {inv.status === "paid" ? (
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                            Paid
                          </span>
                          {inv.receivedDate && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Recd: {inv.receivedDate} (
                              {formatINR(inv.receivedAmount || inv.amount)})
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMarkPaid(inv)}
                          title="Click to convert status to Paid (requires receiving date & amount)"
                          className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer flex items-center gap-1.5 group"
                        >
                          <span>Pending</span>
                          <span className="text-[9px] underline font-medium text-amber-800 dark:text-amber-300 group-hover:text-amber-900">
                            Record Payment
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {inv.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => openMarkPaid(inv)}
                        >
                          Mark Paid
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Print Invoice"
                        onClick={() => handlePrintInvoice(inv)}
                      >
                        <Printer className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Download Invoice File"
                        onClick={() => handleDownloadInvoice(inv)}
                      >
                        <Download className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete Invoice"
                        className="hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(inv.id, inv.number)}
                      >
                        <Trash2 className="size-3.5 text-destructive/80" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

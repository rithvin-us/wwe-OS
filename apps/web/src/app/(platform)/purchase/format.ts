/** Shared money/date formatting for the Purchase module — was duplicated
 * identically in bills-table.tsx and bill-details-dialog.tsx. */
export function formatMoney(amount: string | number, currency = "INR"): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `₹${amount}`;
  const curr = (currency || "INR").toUpperCase();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: curr === "INR" || curr === "RS" ? "INR" : curr,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

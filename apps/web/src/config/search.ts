/** Human labels for search index slugs (platform/search adapter `index` names),
 * shared between the command palette and the /search results page. */
export const INDEX_LABELS: Record<string, string> = {
  assets: "Assets",
  inventory: "Inventory",
  contracts: "Contracts",
  documents: "Documents",
  purchase: "Purchases",
  invoices: "Invoices",
  employees: "Employees",
  customers: "Customers",
};

export function indexLabel(index: string): string {
  return INDEX_LABELS[index] ?? index;
}

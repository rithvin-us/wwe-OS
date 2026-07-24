import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { Input } from "@bop/ui/components/input";
import { PageHeader } from "@bop/ui/components/page-header";

import { indexLabel } from "@/config/search";
import { searchCatalog } from "@/lib/search";

export const metadata: Metadata = {
  title: "Search",
};

const PAGE_SIZE = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const query = q.trim();
  const page = Math.max(Number(pageParam) || 1, 1);
  const data = query ? await searchCatalog({ q: query, page, page_size: PAGE_SIZE }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description={query ? `Results for "${query}"` : "Search across every app."}
      />

      <form action="/search" className="max-w-md">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search apps and pages…"
          autoFocus
        />
      </form>

      {!query ? (
        <EmptyState
          icon={FileSearch}
          title="Start typing to search"
          description="Search every app — assets, purchase bills, contracts, documents, and inventory."
        />
      ) : data && data.results.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No results"
          description={`Nothing matched "${query}". Try a different term.`}
        />
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {data.meta.count} result{data.meta.count === 1 ? "" : "s"}
          </p>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.results.map((row) => (
              <Link
                key={`${row.index}-${row.doc_id}`}
                href={row.url || "#"}
                className="block px-5 py-4 transition-colors hover:bg-accent"
              >
                <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {indexLabel(row.index)}
                </p>
                <p className="font-medium text-foreground">{row.title}</p>
                {row.excerpt ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{row.excerpt}</p>
                ) : null}
              </Link>
            ))}
          </div>
          {data.meta.pages > 1 ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}>
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.meta.page} of {data.meta.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.pages}
                asChild={page < data.meta.pages}
              >
                {page < data.meta.pages ? (
                  <Link href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

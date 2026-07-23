"use client";

import { FileSearch, Layers, LayoutDashboard, Loader2, Moon, Sun, SunMoon } from "@bop/icons";
import { useTheme } from "@bop/theme";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bop/ui/components/command";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { APPS } from "@/config/modules";
import { ADMIN_PAGES } from "@/config/navigation";
import { indexLabel } from "@/config/search";
import type { SearchResponse, SearchResultRow } from "@/lib/search";

const RECENT_SEARCHES_KEY = "wwe-os-recent-searches";
const RECENT_SEARCHES_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

interface RecentSearch {
  title: string;
  url: string;
  index: string;
}

function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(entry: RecentSearch) {
  try {
    const next = [entry, ...loadRecentSearches().filter((r) => r.url !== entry.url)].slice(
      0,
      RECENT_SEARCHES_LIMIT,
    );
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Recent searches are a convenience, not critical — a full localStorage
    // or a private-browsing tab should never break the palette.
  }
}

function groupByIndex(results: SearchResultRow[]): [string, SearchResultRow[]][] {
  const groups = new Map<string, SearchResultRow[]>();
  for (const row of results) {
    const bucket = groups.get(row.index) ?? [];
    bucket.push(row);
    groups.set(row.index, bucket);
  }
  return Array.from(groups.entries());
}

/**
 * The one command palette (Ctrl/⌘ K). Every page in the platform, and now
 * every business record, is reachable from here. With no query it shows the
 * app registry + recent searches; typing 2+ characters queries the platform
 * search index and groups results by module.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    if (open) setRecent(loadRecentSearches());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResponse(null);
    }
  }, [open]);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!searching) {
      setResponse(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" })
        .then((res) => res.json() as Promise<SearchResponse>)
        .then((data) => {
          if (active) setResponse(data);
        })
        .catch(() => {
          if (active) setResponse(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed, searching]);

  const groups = useMemo(
    () => (response ? groupByIndex(response.results) : []),
    [response],
  );

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function goToResult(row: SearchResultRow) {
    saveRecentSearch({ title: row.title, url: row.url, index: row.index });
    go(row.url || "/search");
  }

  function goToRecent(entry: RecentSearch) {
    go(entry.url);
  }

  function viewAllResults() {
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search apps, pages, and records"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search apps, pages, and records…"
      />
      <CommandList>
        {searching ? (
          <>
            {loading && groups.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </div>
            ) : groups.length === 0 ? (
              <CommandEmpty>Nothing matches &ldquo;{trimmed}&rdquo;.</CommandEmpty>
            ) : (
              groups.map(([index, rows]) => (
                <CommandGroup key={index} heading={indexLabel(index)}>
                  {rows.map((row) => (
                    <CommandItem
                      key={`${row.index}-${row.doc_id}`}
                      value={`${row.index}-${row.doc_id}`}
                      onSelect={() => goToResult(row)}
                    >
                      <FileSearch aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate">{row.title}</p>
                        {row.excerpt ? (
                          <p className="truncate text-xs text-muted-foreground">{row.excerpt}</p>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
            {response && response.meta.count > response.results.length ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="view-all-results" onSelect={viewAllResults}>
                    <FileSearch aria-hidden />
                    View all {response.meta.count} results for &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </>
        ) : (
          <>
            <CommandEmpty>Nothing matches that search.</CommandEmpty>
            {recent.length > 0 ? (
              <>
                <CommandGroup heading="Recent">
                  {recent.map((entry) => (
                    <CommandItem
                      key={entry.url}
                      value={`recent-${entry.url}`}
                      onSelect={() => goToRecent(entry)}
                    >
                      <FileSearch aria-hidden />
                      {entry.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            <CommandGroup heading="Apps">
              {APPS.map((app) => (
                <CommandItem
                  key={app.slug}
                  value={`app-${app.slug}`}
                  onSelect={() => go(`/${app.slug}`)}
                >
                  <app.icon aria-hidden />
                  {app.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Platform">
              <CommandItem value="platform-dashboard" onSelect={() => go("/")}>
                <LayoutDashboard aria-hidden />
                Dashboard
              </CommandItem>
              <CommandItem value="platform-services" onSelect={() => go("/services")}>
                <Layers aria-hidden />
                Services
              </CommandItem>
              {ADMIN_PAGES.map((page) => (
                <CommandItem
                  key={page.slug}
                  value={`platform-${page.slug}`}
                  onSelect={() => go(`/${page.slug}`)}
                >
                  <page.icon aria-hidden />
                  {page.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Appearance">
              <CommandItem
                value="theme-light"
                onSelect={() => (setTheme("light"), onOpenChange(false))}
              >
                <Sun aria-hidden />
                Light theme
              </CommandItem>
              <CommandItem
                value="theme-dark"
                onSelect={() => (setTheme("dark"), onOpenChange(false))}
              >
                <Moon aria-hidden />
                Dark theme
              </CommandItem>
              <CommandItem
                value="theme-system"
                onSelect={() => (setTheme("system"), onOpenChange(false))}
              >
                <SunMoon aria-hidden />
                System theme
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

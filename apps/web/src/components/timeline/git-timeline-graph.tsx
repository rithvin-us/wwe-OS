"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCommit, GitBranch, Play, Pause, Search, User } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { describeEntry, timelineHref, type TimelineEntry } from "@/lib/audit-helpers";
import { CommitDiffDialog } from "./commit-diff-dialog";

interface GitTimelineGraphProps {
  initialEntries: TimelineEntry[];
  initialCount: number;
}

const MODULE_THEMES: Record<
  string,
  { label: string; color: string; border: string; bg: string; dot: string; trackColor: string }
> = {
  purchase: {
    label: "Purchase",
    color: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    dot: "bg-blue-500 shadow-blue-500/50",
    trackColor: "#3b82f6",
  },
  hr: {
    label: "HR & Payroll",
    color: "text-purple-500 dark:text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    dot: "bg-purple-500 shadow-purple-500/50",
    trackColor: "#8b5cf6",
  },
  documents: {
    label: "DMS",
    color: "text-sky-500 dark:text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/10",
    dot: "bg-sky-500 shadow-sky-500/50",
    trackColor: "#0284c7",
  },
  assets: {
    label: "Assets",
    color: "text-amber-500 dark:text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    dot: "bg-amber-500 shadow-amber-500/50",
    trackColor: "#f59e0b",
  },
  contracts: {
    label: "Contracts",
    color: "text-rose-500 dark:text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    dot: "bg-rose-500 shadow-rose-500/50",
    trackColor: "#f43f5e",
  },
  automation: {
    label: "Automation",
    color: "text-sky-500 dark:text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/10",
    dot: "bg-sky-500 shadow-sky-500/50",
    trackColor: "#0284c7",
  },
  system: {
    label: "System",
    color: "text-slate-400",
    border: "border-slate-500/30",
    bg: "bg-slate-500/10",
    dot: "bg-slate-400 shadow-slate-400/50",
    trackColor: "#64748b",
  },
};

function getModuleTheme(moduleName: string) {
  return MODULE_THEMES[moduleName] || MODULE_THEMES.system;
}

function generateShortHash(id: string): string {
  if (id.length <= 7) return id;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(7, "0").slice(0, 7);
}

function getRelativeTime(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function GitTimelineGraph({ initialEntries }: GitTimelineGraphProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [pollIntervalSec, setPollIntervalSec] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"graph" | "compact">("graph");
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLive) return;

    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `/api/timeline${selectedModuleFilter !== "all" ? `?module=${selectedModuleFilter}` : ""}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data?.entries) {
          const fetched: TimelineEntry[] = json.data.entries;
          setEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newItems = fetched.filter((e) => !existingIds.has(e.id));
            if (newItems.length > 0) {
              setNewlyAddedIds(
                (prevSet) => new Set([...Array.from(prevSet), ...newItems.map((n) => n.id)]),
              );
              setTimeout(() => {
                setNewlyAddedIds((prevSet) => {
                  const updated = new Set(prevSet);
                  newItems.forEach((n) => updated.delete(n.id));
                  return updated;
                });
              }, 5000);
              return [...newItems, ...prev];
            }
            return prev;
          });
        }
      } catch {
        // Silently handle fetch issues
      }
    };

    const timer = setInterval(fetchLatest, pollIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [isLive, pollIntervalSec, selectedModuleFilter]);

  const filteredEntries = entries.filter((entry) => {
    if (selectedModuleFilter !== "all" && entry.module !== selectedModuleFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const hash = generateShortHash(entry.id).toLowerCase();
      const title = describeEntry(entry).toLowerCase();
      const action = entry.action.toLowerCase();
      const actor = (entry.actor || "").toLowerCase();
      const vendor = (entry.vendorName || "").toLowerCase();
      return (
        hash.includes(query) ||
        title.includes(query) ||
        action.includes(query) ||
        actor.includes(query) ||
        vendor.includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controls & Live Stream Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-sm shadow-xs">
        {/* Left: Real-time Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3 items-center justify-center">
            {isLive ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
              {isLive ? "Live Stream Active" : "Stream Paused"}
            </span>
            <span className="text-xs text-muted-foreground">({pollIntervalSec}s auto-refresh)</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="h-8 gap-1.5 text-xs"
          >
            {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLive ? "Pause" : "Resume"}
          </Button>

          <select
            value={pollIntervalSec}
            onChange={(e) => setPollIntervalSec(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none shadow-xs"
          >
            <option value={3}>3s refresh</option>
            <option value={5}>5s refresh</option>
            <option value={10}>10s refresh</option>
          </select>
        </div>

        {/* Right: Actions & View Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "graph"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Git Graph
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "compact"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              Log Stream
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commits by hash, title, action, actor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-6 sm:justify-end">
          <button
            onClick={() => setSelectedModuleFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedModuleFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Modules ({entries.length})
          </button>
          {Object.entries(MODULE_THEMES).map(([mod, theme]) => {
            if (mod === "system") return null;
            const count = entries.filter((e) => e.module === mod).length;
            return (
              <button
                key={mod}
                onClick={() => setSelectedModuleFilter(mod)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedModuleFilter === mod
                    ? `${theme.bg} ${theme.color} border ${theme.border}`
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {theme.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Git Commit Graph View */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <GitBranch className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium text-foreground">No business commit logs found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or module filters.
          </p>
        </div>
      ) : viewMode === "graph" ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card/40 p-4 sm:p-6 backdrop-blur-xs">
          {/* Legend */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-mono">
              <GitCommit className="h-4 w-4 text-primary" />
              <span>DAG Execution Tree • Click any commit node for JSON diff</span>
            </div>
            <div className="flex items-center gap-3">
              {Object.entries(MODULE_THEMES).map(([mod, theme]) => (
                <div key={mod} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                  <span className="text-[11px] text-muted-foreground">{theme.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Graph Commit Nodes */}
          <div className="relative space-y-4">
            <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gradient-to-b from-blue-600 via-sky-500 to-indigo-500 opacity-30" />

            {filteredEntries.map((entry, index) => {
              const theme = getModuleTheme(entry.module);
              const hash = generateShortHash(entry.id);
              const isNew = newlyAddedIds.has(entry.id);
              const href = timelineHref(entry);
              const title = describeEntry(entry);
              const relativeTime = getRelativeTime(entry.created_at);

              return (
                <div
                  key={entry.id}
                  className={`group relative flex items-start gap-4 transition duration-(--duration-slow) ease-out-quart ${
                    isNew
                      ? "animate-in fade-in slide-in-from-top-3 duration-(--duration-slow) ease-out-quart"
                      : ""
                  }`}
                >
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setDialogOpen(true);
                      }}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform duration-(--duration-base) ease-out-quart group-hover:scale-115 ${
                        theme.border
                      } ${theme.bg} backdrop-blur-md shadow-sm ${
                        isNew ? "ring-4 ring-blue-500/40 animate-pulse" : ""
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${theme.dot}`} />
                    </button>
                    {index < filteredEntries.length - 1 ? (
                      <svg
                        className="absolute left-6 top-9 -z-10 h-8 w-12 opacity-40"
                        viewBox="0 0 40 40"
                        fill="none"
                      >
                        <path
                          d="M0 0 C 20 0, 20 40, 40 40"
                          stroke={theme.trackColor}
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                      </svg>
                    ) : null}
                  </div>

                  <div
                    onClick={() => {
                      setSelectedEntry(entry);
                      setDialogOpen(true);
                    }}
                    className={`flex-1 cursor-pointer rounded-xl border border-border/70 bg-card p-4 transition duration-(--duration-base) ease-out-quart group-hover:border-primary/40 group-hover:shadow-md ${
                      isNew ? "border-blue-500/60 bg-blue-500/5 shadow-blue-500/10" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md tracking-wider">
                          git-{hash}
                        </span>

                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${theme.bg} ${theme.color} border ${theme.border}`}
                        >
                          {entry.action.replace(/[._]/g, " ")}
                        </span>

                        {entry.vendorName ? (
                          <span className="text-xs text-muted-foreground font-medium">
                            • {entry.vendorName}
                          </span>
                        ) : null}
                      </div>

                      <span className="text-xs text-muted-foreground font-mono">
                        {relativeTime}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                        {title}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-[11px]">
                          {entry.actor || "Operator (System)"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {new Date(entry.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>

                        {href ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Link
                              href={href}
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              Open Module &rarr;
                            </Link>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {filteredEntries.map((entry) => {
            const theme = getModuleTheme(entry.module);
            const hash = generateShortHash(entry.id);
            return (
              <div
                key={entry.id}
                onClick={() => {
                  setSelectedEntry(entry);
                  setDialogOpen(true);
                }}
                className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                  <span className="font-mono text-xs font-semibold text-primary">git-{hash}</span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {describeEntry(entry)}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">{entry.module}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {getRelativeTime(entry.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <CommitDiffDialog entry={selectedEntry} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

"use client";

import { History, Pause, Play, PlayCircle, Trash2 } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import { EmptyState } from "@bop/ui/components/empty-state";
import type { TagLike } from "@bop/ui/components/tag-pill";
import type { ColumnDef } from "@tanstack/react-table";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteRuleAction,
  runRuleNowAction,
  toggleRuleActiveAction,
} from "@/app/(platform)/automation/actions";
import { CreateRuleDialog } from "@/app/(platform)/automation/create-rule-dialog";
import {
  DESTINATION_LABELS,
  STUB_DESTINATIONS,
  type AutomationRule,
  type AutomationSource,
} from "@/config/automation";
import type { ReportCatalogEntry } from "@/lib/reports";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RuleActions({ rule }: { rule: AutomationRule }) {
  const [pending, startTransition] = useTransition();
  const isStub = STUB_DESTINATIONS.includes(rule.destination);

  function runNow() {
    startTransition(async () => {
      const result = await runRuleNowAction(rule.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await toggleRuleActiveAction(rule.id, !rule.is_active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteRuleAction(rule.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={runNow}
        disabled={pending || isStub}
        aria-label="Run now"
        title={isStub ? "Not available yet" : "Run now"}
      >
        <PlayCircle aria-hidden />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={toggleActive}
        disabled={pending}
        aria-label={rule.is_active ? "Pause" : "Resume"}
      >
        {rule.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label="Delete rule"
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

const columns: ColumnDef<AutomationRule, unknown>[] = [
  {
    accessorKey: "name",
    header: "Rule",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {DESTINATION_LABELS[row.original.destination]}
          {STUB_DESTINATIONS.includes(row.original.destination) ? " · coming soon" : ""}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "next_run_at",
    header: "Next run",
    cell: ({ row }) => formatDateTime(row.original.next_run_at),
  },
  {
    accessorKey: "last_run_at",
    header: "Last run",
    cell: ({ row }) => formatDateTime(row.original.last_run_at),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "success" : "secondary"}>
        {row.original.is_active ? "Active" : "Paused"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <RuleActions rule={row.original} />,
  },
];

export function RulesTable({
  rules,
  sources,
  reports,
  allTags,
}: {
  rules: AutomationRule[];
  sources: AutomationSource[];
  reports: ReportCatalogEntry[];
  allTags: TagLike[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateRuleDialog sources={sources} reports={reports} allTags={allTags} />
      </div>
      {rules.length === 0 ? (
        <EmptyState
          icon={History}
          title="No automation rules yet"
          description="Create a rule to collect tagged records on a schedule — a downloaded package, a generated report, or an auditor folder."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rules}
          getRowId={(rule) => rule.id}
          empty={{ title: "No rules" }}
        />
      )}
    </div>
  );
}

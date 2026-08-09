"use client";

import { BellRing, Pause, Play, Trash2, Zap } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import { EmptyState } from "@bop/ui/components/empty-state";
import type { ColumnDef } from "@tanstack/react-table";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  checkAlertRuleNowAction,
  deleteAlertRuleAction,
  toggleAlertRuleActiveAction,
} from "@/app/(platform)/automation/alert-actions";
import { CreateAlertRuleDialog } from "@/app/(platform)/automation/create-alert-rule-dialog";
import { METRIC_LABELS, OPERATOR_LABELS, type AlertRule } from "@/config/alerts";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ruleDescription(rule: AlertRule): string {
  if (rule.condition_type === "schedule") {
    return `Daily digest at ${rule.schedule_time?.slice(0, 5) ?? "—"}`;
  }
  const operator = rule.operator ? OPERATOR_LABELS[rule.operator] : "";
  return `${METRIC_LABELS[rule.metric]} ${operator} ${rule.threshold_value ?? "—"}`;
}

function AlertRuleActions({ rule }: { rule: AlertRule }) {
  const [pending, startTransition] = useTransition();

  function checkNow() {
    startTransition(async () => {
      const result = await checkAlertRuleNowAction(rule.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await toggleAlertRuleActiveAction(rule.id, !rule.is_active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteAlertRuleAction(rule.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={checkNow}
        disabled={pending}
        aria-label="Check now"
        title="Check now"
      >
        <Zap aria-hidden />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={toggleActive}
        disabled={pending}
        aria-label={rule.is_active ? "Pause" : "Resume"}
        title={rule.is_active ? "Pause alert" : "Resume alert"}
      >
        {rule.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label="Delete alert"
        title="Delete alert"
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

export function AlertRulesTable({ rules }: { rules: AlertRule[] }) {
  const columns: ColumnDef<AlertRule, unknown>[] = [
    {
      accessorKey: "name",
      header: "Alert",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{ruleDescription(row.original)}</p>
        </div>
      ),
    },
    {
      accessorKey: "last_triggered_at",
      header: "Last sent",
      cell: ({ row }) => formatDateTime(row.original.last_triggered_at),
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
      cell: ({ row }) => <AlertRuleActions rule={row.original} />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateAlertRuleDialog />
      </div>
      {rules.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No alerts yet"
          description="Get pinged on Telegram when a number crosses a line, or receive a daily operational summary at a fixed time."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rules}
          getRowId={(rule) => rule.id}
          empty={{ title: "No alerts" }}
        />
      )}
    </div>
  );
}

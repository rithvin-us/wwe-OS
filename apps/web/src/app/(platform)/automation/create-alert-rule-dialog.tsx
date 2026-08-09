"use client";

import { Plus } from "@bop/icons";
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
import { Textarea } from "@bop/ui/components/textarea";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createAlertRuleAction } from "@/app/(platform)/automation/alert-actions";
import {
  METRIC_LABELS,
  OPERATOR_LABELS,
  THRESHOLD_METRICS,
  type AlertConditionType,
  type AlertMetric,
  type AlertOperator,
} from "@/config/alerts";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const OPERATORS = Object.keys(OPERATOR_LABELS) as AlertOperator[];

export function CreateAlertRuleDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [conditionType, setConditionType] = useState<AlertConditionType>("threshold");
  const [metric, setMetric] = useState<AlertMetric>(THRESHOLD_METRICS[0]);

  const isThreshold = conditionType === "threshold";

  function resetAndClose() {
    setOpen(false);
    setConditionType("threshold");
    setMetric(THRESHOLD_METRICS[0]);
  }

  function handleConditionTypeChange(next: AlertConditionType) {
    setConditionType(next);
    setMetric(next === "threshold" ? THRESHOLD_METRICS[0] : "operational_digest");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Give this alert a name.");
      return;
    }

    if (isThreshold) {
      const thresholdValue = String(form.get("threshold_value") ?? "").trim();
      if (!thresholdValue) {
        toast.error("Enter a value to compare against.");
        return;
      }
      startTransition(async () => {
        const result = await createAlertRuleAction({
          name,
          condition_type: "threshold",
          metric,
          operator: String(form.get("operator") ?? "gt") as AlertOperator,
          threshold_value: thresholdValue,
          channel: "telegram",
          message_template: String(form.get("message_template") ?? ""),
        });
        if (result.ok) {
          toast.success(result.message);
          resetAndClose();
        } else {
          toast.error(result.message);
        }
      });
      return;
    }

    const scheduleTime = String(form.get("schedule_time") ?? "");
    if (!scheduleTime) {
      toast.error("Pick a time of day to send at.");
      return;
    }
    startTransition(async () => {
      const result = await createAlertRuleAction({
        name,
        condition_type: "schedule",
        metric: "operational_digest",
        schedule_time: `${scheduleTime}:00`,
        channel: "telegram",
        message_template: String(form.get("message_template") ?? ""),
      });
      if (result.ok) {
        toast.success(result.message);
        resetAndClose();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus aria-hidden />
          New alert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Telegram alert</DialogTitle>
          <DialogDescription>
            Ping yourself on Telegram when a number crosses a line, or get a daily summary at a
            fixed time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-name">Name</Label>
            <Input id="alert-name" name="name" placeholder="e.g. Too many unpaid bills" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alert-condition-type">When</Label>
            <select
              id="alert-condition-type"
              className={SELECT_CLASS}
              value={conditionType}
              onChange={(event) =>
                handleConditionTypeChange(event.target.value as AlertConditionType)
              }
            >
              <option value="threshold">A number crosses a threshold</option>
              <option value="schedule">On a daily schedule</option>
            </select>
          </div>

          {isThreshold ? (
            <div className="space-y-3 rounded-md border border-input p-3">
              <div className="space-y-1.5">
                <Label htmlFor="alert-metric">Metric</Label>
                <select
                  id="alert-metric"
                  className={SELECT_CLASS}
                  value={metric}
                  onChange={(event) => setMetric(event.target.value as AlertMetric)}
                >
                  {THRESHOLD_METRICS.map((value) => (
                    <option key={value} value={value}>
                      {METRIC_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="alert-operator">Condition</Label>
                  <select
                    id="alert-operator"
                    name="operator"
                    defaultValue="gt"
                    className={SELECT_CLASS}
                  >
                    {OPERATORS.map((value) => (
                      <option key={value} value={value}>
                        {OPERATOR_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alert-threshold-value">Value</Label>
                  <Input
                    id="alert-threshold-value"
                    name="threshold_value"
                    type="number"
                    step="1"
                    min="0"
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 rounded-md border border-input p-3">
              <Label htmlFor="alert-schedule-time">Send at</Label>
              <Input id="alert-schedule-time" name="schedule_time" type="time" required />
              <p className="text-xs text-muted-foreground">
                Sends a summary of purchases needing attention, unpaid bills, and contracts expiring
                soon — once a day at this time.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="alert-message">Custom message (optional)</Label>
            <Textarea
              id="alert-message"
              name="message_template"
              placeholder="Leave blank to use a generated message"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

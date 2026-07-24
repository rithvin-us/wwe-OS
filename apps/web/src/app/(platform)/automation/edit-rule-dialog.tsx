"use client";

import { Pencil } from "@bop/icons";
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
import { TagPicker, type TagPickerChange } from "@bop/ui/components/tag-picker";
import type { TagLike } from "@bop/ui/components/tag-pill";
import { Textarea } from "@bop/ui/components/textarea";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateRuleAction } from "@/app/(platform)/automation/actions";
import {
  CADENCE_LABELS,
  DESTINATION_LABELS,
  STUB_DESTINATIONS,
  type AutomationCadence,
  type AutomationDestination,
  type AutomationRule,
  type AutomationSource,
} from "@/config/automation";
import type { ReportCatalogEntry } from "@/lib/reports";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const DESTINATIONS = Object.keys(DESTINATION_LABELS) as AutomationDestination[];
const CADENCES = Object.keys(CADENCE_LABELS) as AutomationCadence[];

function formatForDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function EditRuleDialog({
  rule,
  sources,
  reports,
  allTags,
}: {
  rule: AutomationRule;
  sources: AutomationSource[];
  reports: ReportCatalogEntry[];
  allTags: TagLike[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState<AutomationDestination>(rule.destination);
  const [selectedModules, setSelectedModules] = useState<string[]>(rule.source_modules || []);
  const [tags, setTags] = useState<TagLike[]>(() =>
    allTags.filter((t) => (rule.required_tags || []).includes(t.id)),
  );
  const [cadence, setCadence] = useState<AutomationCadence>(rule.cadence || "once");

  const needsSources = destination !== "generate_report";
  const needsReport = destination === "generate_report";

  const tagIds = useMemo(() => tags.map((t) => t.id), [tags]);

  function toggleModule(module: string) {
    setSelectedModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module],
    );
  }

  function handleTagsChange(change: TagPickerChange) {
    setTags(allTags.filter((tag) => change.tagIds.includes(tag.id)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tagIds.length === 0) {
      toast.error("At least one tag is required — pick what this rule collects.");
      return;
    }
    if (needsSources && selectedModules.length === 0) {
      toast.error("Choose at least one source.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const nextRunAtLocal = String(form.get("next_run_at") ?? "");

    startTransition(async () => {
      const result = await updateRuleAction(rule.id, {
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? ""),
        destination,
        source_modules: needsSources ? selectedModules : [],
        report_key: needsReport ? String(form.get("report_key") ?? "") : "",
        export_format: String(form.get("export_format") ?? "csv"),
        required_tags: tagIds,
        cadence: String(form.get("cadence") ?? "once") as AutomationCadence,
        ...(nextRunAtLocal ? { next_run_at: new Date(nextRunAtLocal).toISOString() } : {}),
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Edit rule" title="Edit automation rule">
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit automation rule</DialogTitle>
          <DialogDescription>
            Update rule metadata, tags, cadence, or trigger schedule.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-rule-name-${rule.id}`}>Name</Label>
            <Input
              id={`edit-rule-name-${rule.id}`}
              name="name"
              defaultValue={rule.name}
              placeholder="e.g. Quarterly auditor bundle"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-rule-description-${rule.id}`}>Description</Label>
            <Textarea
              id={`edit-rule-description-${rule.id}`}
              name="description"
              defaultValue={rule.description}
              placeholder="Optional"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`edit-rule-destination-${rule.id}`}>Destination</Label>
            <select
              id={`edit-rule-destination-${rule.id}`}
              className={SELECT_CLASS}
              value={destination}
              onChange={(event) => setDestination(event.target.value as AutomationDestination)}
            >
              {DESTINATIONS.map((value) => (
                <option key={value} value={value}>
                  {DESTINATION_LABELS[value]}
                  {STUB_DESTINATIONS.includes(value) ? " — coming soon" : ""}
                </option>
              ))}
            </select>
            {STUB_DESTINATIONS.includes(destination) ? (
              <p className="text-xs text-muted-foreground">
                This rule will be saved, but can&apos;t run until this destination ships.
              </p>
            ) : null}
          </div>

          {needsSources ? (
            <div className="space-y-1.5">
              <Label>Sources</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-input px-3 py-2">
                {sources.map((source) => (
                  <label key={source.module} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(source.module)}
                      onChange={() => toggleModule(source.module)}
                    />
                    {source.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {needsReport ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`edit-rule-report-${rule.id}`}>Report</Label>
                <select
                  id={`edit-rule-report-${rule.id}`}
                  name="report_key"
                  defaultValue={rule.report_key}
                  className={SELECT_CLASS}
                  required
                >
                  {reports.map((report) => (
                    <option key={report.key} value={report.key}>
                      {report.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-rule-format-${rule.id}`}>Format</Label>
                <select
                  id={`edit-rule-format-${rule.id}`}
                  name="export_format"
                  defaultValue={rule.export_format || "csv"}
                  className={SELECT_CLASS}
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Required tags</Label>
            <TagPicker tags={tags} allTags={allTags} onChange={handleTagsChange} />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`edit-rule-cadence-${rule.id}`}>Repeats</Label>
                <select
                  id={`edit-rule-cadence-${rule.id}`}
                  name="cadence"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as AutomationCadence)}
                  className={SELECT_CLASS}
                >
                  {CADENCES.map((value) => (
                    <option key={value} value={value}>
                      {CADENCE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-rule-next-run-${rule.id}`}>Trigger date</Label>
                <Input
                  id={`edit-rule-next-run-${rule.id}`}
                  name="next_run_at"
                  type="datetime-local"
                  defaultValue={formatForDatetimeLocal(rule.next_run_at)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {cadence === "once"
                ? "This rule will run once at the selected trigger date."
                : `This rule will automatically repeat every ${cadence === "daily" ? "day" : cadence === "weekly" ? "week" : "month"} starting from the trigger date.`}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

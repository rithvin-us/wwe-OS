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
import { TagPicker, type TagPickerChange } from "@bop/ui/components/tag-picker";
import type { TagLike } from "@bop/ui/components/tag-pill";
import { Textarea } from "@bop/ui/components/textarea";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createRuleAction } from "@/app/(platform)/automation/actions";
import {
  CADENCE_LABELS,
  DESTINATION_LABELS,
  STUB_DESTINATIONS,
  type AutomationCadence,
  type AutomationDestination,
  type AutomationSource,
} from "@/config/automation";
import type { ReportCatalogEntry } from "@/lib/reports";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const DESTINATIONS = Object.keys(DESTINATION_LABELS) as AutomationDestination[];
const CADENCES = Object.keys(CADENCE_LABELS) as AutomationCadence[];

export function CreateRuleDialog({
  sources,
  reports,
  allTags,
}: {
  sources: AutomationSource[];
  reports: ReportCatalogEntry[];
  allTags: TagLike[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState<AutomationDestination>("downloaded_package");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [tags, setTags] = useState<TagLike[]>([]);

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

  function resetAndClose() {
    setOpen(false);
    setDestination("downloaded_package");
    setSelectedModules([]);
    setTags([]);
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
    if (!nextRunAtLocal) {
      toast.error("Pick a date to trigger this rule.");
      return;
    }

    startTransition(async () => {
      const result = await createRuleAction({
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? ""),
        destination,
        source_modules: needsSources ? selectedModules : [],
        report_key: needsReport ? String(form.get("report_key") ?? "") : "",
        export_format: String(form.get("export_format") ?? "csv"),
        required_tags: tagIds,
        cadence: String(form.get("cadence") ?? "once") as AutomationCadence,
        next_run_at: new Date(nextRunAtLocal).toISOString(),
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
        <Button>
          <Plus aria-hidden />
          New rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New automation rule</DialogTitle>
          <DialogDescription>
            Only tagged records qualify — nothing is collected untagged, even for internal
            destinations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              name="name"
              placeholder="e.g. Quarterly auditor bundle"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-description">Description</Label>
            <Textarea id="rule-description" name="description" placeholder="Optional" rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-destination">Destination</Label>
            <select
              id="rule-destination"
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
                You can save this rule now, but it can&apos;t run until this destination ships.
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
                <Label htmlFor="rule-report">Report</Label>
                <select id="rule-report" name="report_key" className={SELECT_CLASS} required>
                  {reports.map((report) => (
                    <option key={report.key} value={report.key}>
                      {report.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-format">Format</Label>
                <select
                  id="rule-format"
                  name="export_format"
                  defaultValue="csv"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-cadence">Repeats</Label>
              <select id="rule-cadence" name="cadence" defaultValue="once" className={SELECT_CLASS}>
                {CADENCES.map((value) => (
                  <option key={value} value={value}>
                    {CADENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-next-run">Trigger date</Label>
              <Input id="rule-next-run" name="next_run_at" type="datetime-local" required />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

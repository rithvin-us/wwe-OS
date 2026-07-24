"use client";

import { Check, Plus, Upload } from "@bop/icons";
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
import { TagPill, type TagColor } from "@bop/ui/components/tag-pill";
import { Textarea } from "@bop/ui/components/textarea";
import { cn } from "@bop/ui/lib/utils";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadDocumentAction } from "@/app/(platform)/dms/actions";
import { DOCUMENT_CATEGORIES } from "@/lib/dms-constants";

// Native select styled to match the platform Input — @bop/ui has no Select
// primitive yet, and a labelled native control is accessible and on-pattern.
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const PRESET_TAGS = [
  "Auditor",
  "GST",
  "Monthly",
  "Invoice",
  "Contract",
  "Compliance",
  "Tax",
  "HR",
  "Asset",
  "Receipt",
];

const TAG_COLORS: TagColor[] = ["blue", "green", "amber", "violet", "rose"];
function getTagColor(name: string): TagColor {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  function resetFormState() {
    setSelectedFile(null);
    setSelectedTags([]);
    setCustomTagInput("");
  }

  function toggleTag(tagName: string) {
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === tagName.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tagName.toLowerCase())
        : [...prev, tagName],
    );
  }

  function removeTag(tagName: string) {
    setSelectedTags((prev) => prev.filter((t) => t.toLowerCase() !== tagName.toLowerCase()));
  }

  function addCustomTag() {
    const trimmed = customTagInput.trim().replace(/^,|,$/g, "");
    if (!trimmed) return;
    if (!selectedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setCustomTagInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      if (result.ok) {
        toast.success(result.message);
        resetFormState();
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetFormState();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden />
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            The file is stored securely and summarized automatically. You can send it for approval
            afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="document-file">File</Label>
            <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-4 text-center transition-colors hover:border-primary/50 hover:bg-accent/20">
              <input
                id="document-file"
                name="file"
                type="file"
                required
                className="absolute inset-0 z-10 cursor-pointer opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                }}
              />
              <Upload className="mb-1 size-6 text-muted-foreground" />
              {selectedFile ? (
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">{selectedFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">
                    Click or drop file to upload
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, PNG, JPG, DOCX (up to 25 MB)
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-title">Title</Label>
            <Input id="document-title" name="title" placeholder="e.g. Office lease 2026" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-category">Category</Label>
            <select
              id="document-category"
              name="category"
              defaultValue="other"
              className={SELECT_CLASS}
            >
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-description">Description</Label>
            <Textarea
              id="document-description"
              name="description"
              rows={2}
              placeholder="Optional — a line about what this is."
            />
          </div>

          {/* Interactive Tag Bubbles Section */}
          <div className="space-y-2">
            <Label htmlFor="custom-tag-input">Tags</Label>
            <input type="hidden" name="tags" value={selectedTags.join(", ")} />

            {/* Selected Tag Bubbles */}
            {selectedTags.length > 0 && (
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/20 p-2">
                {selectedTags.map((tagName) => (
                  <TagPill
                    key={tagName}
                    tag={{ id: tagName, name: tagName, color: getTagColor(tagName) }}
                    onRemove={() => removeTag(tagName)}
                  />
                ))}
              </div>
            )}

            {/* Quick Preset Bubbles */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Quick select tags:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_TAGS.map((preset) => {
                  const isSelected = selectedTags.some(
                    (t) => t.toLowerCase() === preset.toLowerCase(),
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => toggleTag(preset)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : <Plus className="size-3" />}
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Tag Input */}
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                id="custom-tag-input"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="Type custom tag & press Enter..."
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={addCustomTag}
              >
                <Plus className="size-3" /> Add tag
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Upload document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

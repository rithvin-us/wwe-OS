"use client";

import { Upload } from "@bop/icons";
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

import { uploadDocumentAction } from "@/app/(platform)/dms/actions";
import { DOCUMENT_CATEGORIES } from "@/lib/dms-constants";

// Native select styled to match the platform Input — @bop/ui has no Select
// primitive yet, and a labelled native control is accessible and on-pattern.
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
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
        <Button>
          <Upload aria-hidden />
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
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
            <Input id="document-file" name="file" type="file" required />
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
              rows={3}
              placeholder="Optional — a line about what this is."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-tags">Tags</Label>
            <Input
              id="document-tags"
              name="tags"
              placeholder="e.g. Auditor, GST, Monthly — comma-separated"
            />
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

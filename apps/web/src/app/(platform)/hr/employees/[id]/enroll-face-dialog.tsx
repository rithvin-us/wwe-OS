"use client";

import { useState } from "react";
import { Upload, ScanFace } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { toast } from "sonner";

import { enrollFace } from "../../actions";

export function EnrollFaceDialog({
  employeeId,
  employeeName,
  isEnrolled,
}: {
  employeeId: string;
  employeeName: string;
  isEnrolled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast.error("Please select a face photo to upload.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("image", selectedFile);

    const res = await enrollFace(employeeId, formData);
    setLoading(false);

    if (res.ok) {
      toast.success(`Face photo enrolled successfully for ${employeeName}!`);
      setOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } else {
      toast.error(res.error || "Face enrollment failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={isEnrolled ? "outline" : "default"}
          className="gap-1.5 cursor-pointer"
        >
          <ScanFace className="size-4" />
          {isEnrolled ? "Re-enroll Face Photo" : "Upload Reference Photo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-5 text-emerald-600" />
            Enroll Face Biometrics — {employeeName}
          </DialogTitle>
          <DialogDescription>
            Upload a clear front-facing portrait photo. InsightFace AI will extract the face
            embedding for automated camera check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {previewUrl ? (
            <div className="relative flex flex-col items-center justify-center p-4 border border-border rounded-lg bg-muted/30">
              <img
                src={previewUrl}
                alt="Face preview"
                className="size-40 object-cover rounded-full border-2 border-emerald-500 shadow-md"
              />
              <p className="mt-2 text-xs text-muted-foreground">{selectedFile?.name}</p>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-border rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
              <Upload className="size-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Click to select photo</span>
              <span className="text-xs text-muted-foreground mt-1">
                PNG or JPG (Clear front view)
              </span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={loading || !selectedFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? "Processing AI Embedding..." : "Enroll Face Photo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

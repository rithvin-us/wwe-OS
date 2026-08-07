"use client";

import * as React from "react";
import { UploadCloud } from "@bop/icons";

import { cn } from "@bop/ui/lib/utils";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

/**
 * The one drag-and-drop file intake surface. Any module that needs an
 * operator to hand it a document (Purchase bill, DMS upload, …) uses this
 * instead of growing its own dropzone.
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  maxSizeBytes,
  disabled = false,
  label = "Drop a file here, or click to browse",
  hint,
  className,
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function acceptFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (maxSizeBytes) {
      const tooLarge = files.find((f) => f.size > maxSizeBytes);
      if (tooLarge) {
        setError(
          `${tooLarge.name} is over the ${Math.round(maxSizeBytes / (1024 * 1024))}MB limit.`,
        );
        return;
      }
    }
    setError(null);
    onFiles(multiple ? files : [files[0]]);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) acceptFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-(--duration-base)",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40",
          disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent",
        )}
      >
        <UploadCloud aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => acceptFiles(e.target.files)}
      />
    </div>
  );
}

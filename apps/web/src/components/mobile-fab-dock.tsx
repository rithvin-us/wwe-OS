"use client";

import { Camera, Mic } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { cn } from "@bop/ui/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { VoiceNoteSheet } from "@/components/voice-note-sheet";

/**
 * Thumb-reachable quick-action bar for mobile viewports — the two things an
 * operator needs to log on the move: snap a receipt or leave a voice note.
 * Sits bottom-center so it never collides with the Rithu chat bubble
 * anchored bottom-right (rithu-chat-widget.tsx).
 */
export function MobileFabDock() {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  async function handleReceiptFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/purchase/bills/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data?.message || "Couldn't read that bill. Try again.");
        return;
      }
      toast.success(`Bill scanned — ${data.seller_name || "Purchases"} added.`);
      if (pathname.startsWith("/purchase")) router.refresh();
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleReceiptFile(file);
        }}
      />

      <div
        className="fixed inset-x-0 z-(--z-sticky) flex justify-center lg:hidden"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md max-md:backdrop-blur-none">
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            className="rounded-full"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Photograph a purchase receipt"
            title="Snap a receipt"
          >
            <Camera className={cn("size-5", uploading && "animate-pulse")} />
          </Button>

          <span className="h-6 w-px bg-border" aria-hidden />

          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            className="rounded-full"
            onClick={() => setVoiceOpen(true)}
            aria-label="Record a voice note"
            title="Voice note"
          >
            <Mic className="size-5" />
          </Button>
        </div>
      </div>

      <VoiceNoteSheet open={voiceOpen} onOpenChange={setVoiceOpen} />
    </>
  );
}

"use client";

import { Mic, Play, Square, Trash2 } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@bop/ui/components/sheet";
import { cn } from "@bop/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { logVoiceNoteAction } from "@/lib/audit-actions";

type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "submitting";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Bottom sheet for logging a quick spoken note — records in-browser via
 * MediaRecorder, previews the clip, then posts it to the Business Timeline
 * as an audit entry (the same feed the dashboard's "Recent activity" and
 * /timeline read from).
 */
export function VoiceNoteSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset to a clean slate every time the sheet opens, and release the
  // microphone/object URL the moment it closes — a background recording or
  // a leaked blob URL surviving a closed sheet is exactly the kind of bug
  // that only shows up after using the feature for a while.
  useEffect(() => {
    if (open) {
      setState("idle");
      setElapsedMs(0);
      setAudioUrl(null);
      chunksRef.current = [];
      return;
    }
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open]);

  function stopStream() {
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
  }

  async function startRecording() {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setState("recorded");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setState("recording");

      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch {
      toast.error("Couldn't access the microphone. Check your browser permissions.");
      setState("idle");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    stopStream();
  }

  function discardRecording() {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setElapsedMs(0);
    setState("idle");
  }

  async function submitRecording() {
    if (!chunksRef.current.length) return;
    setState("submitting");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.set("audio", blob, `voice-note-${Date.now()}.webm`);
    formData.set("duration_ms", String(elapsedMs));

    const result = await logVoiceNoteAction(formData);
    if (!result.ok) {
      toast.error(result.message);
      setState("recorded");
      return;
    }
    toast.success(result.message);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Voice note</SheetTitle>
          <SheetDescription>
            Say what happened — it&rsquo;s logged to the Business Timeline as text you can search
            later.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center gap-4 px-4 pb-2">
          {state === "idle" || state === "requesting" ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={state === "requesting"}
              className="flex size-20 items-center justify-center rounded-full bg-destructive text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
              aria-label="Start recording"
            >
              <Mic className="size-8" />
            </button>
          ) : null}

          {state === "recording" ? (
            <>
              <button
                type="button"
                onClick={stopRecording}
                className="flex size-20 items-center justify-center rounded-full bg-destructive text-white shadow-lg animate-pulse"
                aria-label="Stop recording"
              >
                <Square className="size-7" />
              </button>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatDuration(elapsedMs)}
              </span>
            </>
          ) : null}

          {state === "recorded" || state === "submitting" ? (
            <div className="w-full space-y-3">
              {audioUrl ? <audio src={audioUrl} controls className="w-full" /> : null}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Play className="size-3.5" aria-hidden />
                {formatDuration(elapsedMs)} recorded
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={state === "submitting"}
                  onClick={discardRecording}
                >
                  <Trash2 className="size-3.5" /> Discard
                </Button>
                <Button
                  type="button"
                  className={cn("flex-1")}
                  disabled={state === "submitting"}
                  onClick={submitRecording}
                >
                  {state === "submitting" ? "Saving…" : "Save to Timeline"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="pt-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

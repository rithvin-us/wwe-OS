"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanFace, CheckCircle2, AlertCircle, RefreshCw } from "@bop/icons";
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

import { useFaceCapture } from "@/hooks/use-face-capture";

// Matches CheckInResponseSerializer (modules/hr/backend/serializers/checkin.py).
interface CheckInResult {
  recognized: boolean;
  employee_name: string | null;
  employee_code: string | null;
  decision: "auto_approved" | "flagged";
  direction: "in" | "out";
  time: string;
  message: string;
}

export function FaceKioskDialog() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { cameraActive, geo, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  // Start webcam when modal opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setResult(null);
      setErrorMessage(null);
    }
  }, [open]);

  async function captureAndPunch() {
    if (!videoRef.current || !cameraActive) {
      toast.error("Webcam is not active.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);
    setResult(null);

    const burst = await captureBurst();
    if (!burst) {
      setScanning(false);
      toast.error("Failed to capture webcam frame.");
      return;
    }

    const formData = new FormData();
    formData.append("file", burst.primary, "selfie.jpg");
    burst.frames.forEach((frame, i) => formData.append("frames", frame, `frame-${i}.jpg`));
    if (geo) {
      formData.append("lat", String(geo.lat));
      formData.append("lon", String(geo.lon));
      formData.append("accuracy", String(geo.accuracy));
    }

    try {
      const resp = await fetch("/api/hr/attendance/checkin", {
        method: "POST",
        body: formData,
      });
      const res = await resp.json().catch(() => null);
      setScanning(false);

      if (resp.ok && res?.ok && res.data) {
        setResult(res.data as CheckInResult);
        if (res.data.recognized && res.data.decision === "auto_approved") {
          toast.success(
            `Punch Registered! ${res.data.employee_name} marked ${res.data.direction?.toUpperCase() || "IN"}`,
          );
        } else {
          toast.warning(res.data.message || "Recognized but flagged for review.");
        }
      } else {
        toast.error(res?.error || "Face recognition check-in failed.");
      }
    } catch (err: unknown) {
      setScanning(false);
      toast.error(err instanceof Error ? err.message : "Network error.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer shadow-sm"
        >
          <Camera className="size-4" />
          Face AI Kiosk Check-In
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-5 text-blue-600 dark:text-blue-400" />
            AI Face Recognition Kiosk
          </DialogTitle>
          <DialogDescription>
            Stand in front of the camera. The AI will detect your face, verify identity, and punch
            your attendance automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Result Banner */}
          {result?.recognized && result.decision === "auto_approved" ? (
            <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 space-y-1 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 font-semibold text-base">
                <CheckCircle2 className="size-5 text-blue-500" />
                Attendance Marked — {result.direction?.toUpperCase() || "PUNCH"}
              </div>
              <p className="text-sm font-medium">
                {result.employee_name} ({result.employee_code})
              </p>
              <p className="text-xs text-muted-foreground">{result.message || result.time}</p>
            </div>
          ) : result?.recognized ? (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              <p className="font-medium">{result.employee_name} — Flagged for Review</p>
              <p className="mt-0.5 opacity-90">{result.message}</p>
            </div>
          ) : errorMessage ? (
            <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          ) : null}

          {/* Live Camera Viewfinder */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 p-2 shadow-inner flex items-center justify-center min-h-[260px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-64 object-cover rounded-lg border border-blue-500/40 ${cameraActive ? "block" : "hidden"}`}
              style={{ transform: "none" }}
            />

            {!cameraActive ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Camera className="size-10 text-slate-500" />
                <p className="text-xs">Webcam feed inactive or permission requested.</p>
                <Button size="xs" variant="outline" onClick={startCamera} className="gap-1">
                  <RefreshCw className="size-3" /> Retry Camera Access
                </Button>
              </div>
            ) : null}

            {scanning ? (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-blue-400 space-y-2">
                <ScanFace className="size-10 animate-bounce" />
                <span className="text-xs font-semibold">Matching Face Biometrics...</span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => captureAndPunch()}
              disabled={scanning || !cameraActive}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
            >
              <Camera className="size-4" />
              {scanning ? "Scanning..." : "Scan & Punch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanFace, CheckCircle2, AlertCircle, RefreshCw, Upload } from "@bop/icons";
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

import { checkInFace } from "../actions";

export function FaceKioskDialog() {
  const [open, setOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    employee_code?: string;
    employee_name?: string;
    action?: string;
    timestamp?: string;
    message?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  async function startCamera() {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Camera access failed:", err);
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function captureAndPunch(blobToSubmit?: Blob) {
    let selfieBlob = blobToSubmit;

    if (!selfieBlob) {
      if (!videoRef.current || !cameraActive) {
        toast.error("Webcam is not active.");
        return;
      }

      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      selfieBlob =
        (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))) ||
        undefined;
    }

    if (!selfieBlob) {
      toast.error("Failed to capture webcam frame.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selfieBlob, "selfie.jpg");

    const res = await checkInFace(formData);
    setScanning(false);

    if (res.ok) {
      setResult(res.data);
      if (res.data.matched) {
        toast.success(
          `Punch Registered! ${res.data.employee_name} marked ${res.data.action || "IN"}`,
        );
      } else {
        toast.warning(
          res.data.message || "Face not recognized. Please stand clearly in front of camera.",
        );
      }
    } else {
      setErrorMessage(res.error || "Attendance punch failed.");
      toast.error(res.error || "Attendance punch failed.");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      captureAndPunch(file);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-sm"
        >
          <Camera className="size-4" />
          Face AI Kiosk Check-In
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-5 text-emerald-600 dark:text-emerald-400" />
            AI Face Recognition Kiosk
          </DialogTitle>
          <DialogDescription>
            Stand in front of the camera. The AI will detect your face, verify identity, and punch
            your attendance automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Result Banner */}
          {result?.matched ? (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 space-y-1 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 font-semibold text-base">
                <CheckCircle2 className="size-5 text-emerald-500" />
                Attendance Marked — {result.action || "PUNCH"}
              </div>
              <p className="text-sm font-medium">
                {result.employee_name} ({result.employee_code})
              </p>
              <p className="text-xs text-muted-foreground">{result.message || result.timestamp}</p>
            </div>
          ) : result && !result.matched ? (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              <p className="font-medium">Face Not Recognized</p>
              <p className="mt-0.5 opacity-90">
                {result.message || "Ensure your face is well-lit and enrolled in the system."}
              </p>
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
              className={`w-full h-64 object-cover rounded-lg border border-emerald-500/40 ${cameraActive ? "block" : "hidden"}`}
            />

            {!cameraActive ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Camera className="size-10 text-slate-500" />
                <p className="text-xs">Webcam feed inactive or permission requested.</p>
                <Button size="xs" variant="outline" onClick={startCamera} className="gap-1">
                  <RefreshCw className="size-3" /> Retry Camera Access
                </Button>
              </div>
            ) : (
              /* Oval Biometric Overlay */
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="size-48 rounded-full border-2 border-dashed border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse" />
              </div>
            )}

            {scanning ? (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-400 space-y-2">
                <ScanFace className="size-10 animate-bounce" />
                <span className="text-xs font-semibold">Matching Face Biometrics...</span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              <Upload className="size-3.5" /> Upload Photo Instead
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => captureAndPunch()}
                disabled={scanning || !cameraActive}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
              >
                <Camera className="size-4" />
                {scanning ? "Scanning..." : "Scan & Punch"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, CheckCircle2, AlertCircle, RefreshCw } from "@bop/icons";

import { useFaceCapture } from "@/hooks/use-face-capture";

// Matches CheckInResponseSerializer (modules/hr/backend/serializers/checkin.py)
// exactly — the Route Handler now forwards this object as-is on success.
interface CheckInResult {
  recognized: boolean;
  employee_name: string | null;
  employee_code: string | null;
  decision: "auto_approved" | "flagged";
  direction: "in" | "out";
  time: string;
  message: string;
}

export function PublicMobileCheckIn() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const { cameraActive, geo, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // The page used to vertically auto-center its content (my-auto below) —
  // once a result banner made the page taller than a short mobile viewport,
  // the header+banner could center-scroll above the fold while the camera
  // and button stayed put, so a real success/failure looked like nothing
  // happened. Force it into view explicitly on every result/error change.
  useEffect(() => {
    if (result || errorMessage) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, errorMessage]);

  async function captureAndPunch() {
    if (!videoRef.current || !cameraActive) {
      setErrorMessage("Camera is not active. Please allow camera permissions.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);
    setResult(null);

    const burst = await captureBurst();
    if (!burst) {
      setScanning(false);
      setErrorMessage("Failed to capture photo frame.");
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
      const res = await fetch("/api/hr/attendance/checkin", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setScanning(false);

      if (res.ok) {
        // route.ts wraps the real payload as { ok: true, data: <checkin result> }.
        setResult(data.data as CheckInResult);
      } else {
        // The Route Handler's error field is `error`, not `message`/`detail` —
        // those never existed on this response shape, so every failure was
        // silently falling through to the generic fallback below.
        setErrorMessage(data.error || "Check-in failed. Please try again.");
      }
    } catch (err) {
      setScanning(false);
      setErrorMessage(err instanceof Error ? err.message : "Network error during check-in.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center p-4 sm:p-6 font-sans">
      <main className="w-full max-w-md mx-auto space-y-4 py-6">
        {/* Header Title matching exact user screenshot */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance check-in</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Face the camera and stay at the work site, then tap check-in. No login needed.
          </p>
        </div>

        {/* Result Banner — scroll-anchored so it can't render off-screen on a
            short mobile viewport (see the scrollIntoView effect above). */}
        <div ref={resultRef} className="scroll-mt-4">
          {result?.recognized && result.decision === "auto_approved" ? (
            <div className="p-4 rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-900 space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-base text-emerald-800">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                Marked {result.direction?.toUpperCase() || "PUNCH"} Successfully
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {result.employee_name} ({result.employee_code})
              </p>
              <p className="text-xs text-slate-600">{result.message || result.time}</p>
            </div>
          ) : result?.recognized ? (
            // Identified, but flagged (liveness/geofence/marginal score) — the
            // punch was NOT recorded. Distinct from "no face matched at all":
            // the employee needs to retry, not assume they're unenrolled.
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-50 text-amber-900 text-xs space-y-1">
              <p className="font-bold text-sm text-amber-800">
                {result.employee_name} — Flagged for Review
              </p>
              <p className="text-slate-700">{result.message}</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
              <div>{errorMessage}</div>
            </div>
          ) : null}
        </div>

        {/* Camera Viewfinder (Clean Rounded Box, NO green circle overlay) */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm aspect-[3/4] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover rounded-2xl ${cameraActive ? "block" : "hidden"}`}
            style={{ transform: "none" }}
          />

          {!cameraActive ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 space-y-3">
              <p className="text-xs text-slate-400">Camera feed initializing...</p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="size-3.5" /> Enable Camera
              </button>
            </div>
          ) : null}

          {scanning ? (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
              <RefreshCw className="size-8 animate-spin text-emerald-400" />
              <span className="text-sm font-semibold tracking-wide">
                Hold still, checking in...
              </span>
            </div>
          ) : null}
        </div>

        {/* Check in / out Button (Matching exact green button from screenshot) */}
        <button
          onClick={() => captureAndPunch()}
          disabled={scanning || !cameraActive}
          className="w-full py-3.5 px-4 rounded-xl bg-[#047857] hover:bg-[#065f46] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <MapPin className="size-5" />
          {scanning ? "Checking in..." : "Check in / out"}
        </button>

        {/* Notice text matching exact screenshot */}
        <p className="text-center text-xs text-slate-500 pt-1">
          Your photo is used only to verify identity and is not stored.{" "}
          <Link href="/privacy" className="underline hover:text-slate-700">
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  );
}

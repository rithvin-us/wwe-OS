"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  ShieldAlert,
} from "@bop/icons";

import { useFaceCapture } from "@/hooks/use-face-capture";

// Matches CheckInResponseSerializer (modules/hr/backend/serializers/checkin.py)
// field-for-field — the Route Handler forwards this object as-is on success.
interface CheckInResult {
  recognized: boolean;
  employee_id: string | null;
  employee_name: string | null;
  employee_code: string | null;
  decision: "auto_approved" | "flagged";
  direction: "in" | "out";
  shift: string;
  time: string;
  within_geofence: boolean;
  face_score: number;
  confidence: number;
  message: string;
}

// The app's existing status-chip signature (design-bible.md §"signature"):
// monospace, uppercase, 1px ring, tinted fill — reused here rather than
// invented fresh, so this page still reads as the same product.
function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "warning" | "error";
  children: React.ReactNode;
}) {
  const toneClasses = {
    success: "bg-blue-500/10 text-blue-700 ring-blue-600/30",
    warning: "bg-amber-500/10 text-amber-700 ring-amber-600/30",
    error: "bg-rose-500/10 text-rose-700 ring-rose-600/30",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase ring-1 ${toneClasses}`}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="font-mono text-[11px] tracking-[0.06em] text-slate-500 uppercase">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function formatShift(shift: string): string {
  if (!shift) return "—";
  return shift.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PublicMobileCheckIn() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { cameraActive, geo, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  function reset() {
    setResult(null);
    setErrorMessage(null);
  }

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
        // silently falling through to a generic fallback.
        setErrorMessage(data.error || "Check-in failed. Please try again.");
      }
    } catch (err) {
      setScanning(false);
      setErrorMessage(err instanceof Error ? err.message : "Network error during check-in.");
    }
  }

  const showResult = Boolean(result || errorMessage);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center p-4 sm:p-6 font-sans">
      <main className="w-full max-w-md mx-auto space-y-4 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance check-in</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Face the camera and stay at the work site, then tap check-in. No login needed.
          </p>
        </div>

        {showResult ? (
          // Result REPLACES the camera view entirely, rather than sharing the
          // page with it — a banner squeezed above the viewfinder could end up
          // scrolled out of view on a short mobile screen with no way to tell
          // it had ever appeared. This can't be missed.
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {result?.decision === "auto_approved" ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-500/10">
                  <CheckCircle2 className="size-8 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <StatusChip tone="success">
                    {result.direction === "in" ? (
                      <LogIn className="size-3" />
                    ) : (
                      <LogOut className="size-3" />
                    )}
                    Checked {result.direction}
                  </StatusChip>
                  <p className="pt-2 text-xl font-bold text-slate-900">{result.employee_name}</p>
                  <p className="font-mono text-xs text-slate-500">{result.employee_code}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 text-left">
                  <DetailRow label="Attendance" value="Marked" />
                  <DetailRow label="Direction" value={result.direction === "in" ? "In" : "Out"} />
                  <DetailRow label="Shift" value={formatShift(result.shift)} />
                  <DetailRow label="Time" value={result.time} />
                  <DetailRow label="Match confidence" value={`${result.confidence.toFixed(0)}%`} />
                </div>
              </div>
            ) : result?.recognized ? (
              // Identified, but flagged (liveness/geofence/marginal score) —
              // the punch was NOT recorded. Distinct from "no match at all":
              // this person is enrolled and needs to retry, not re-enroll.
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10">
                  <ShieldAlert className="size-8 text-amber-600" />
                </div>
                <div className="space-y-1">
                  <StatusChip tone="warning">Flagged for review</StatusChip>
                  <p className="pt-2 text-xl font-bold text-slate-900">{result.employee_name}</p>
                  <p className="font-mono text-xs text-slate-500">{result.employee_code}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 text-left">
                  <DetailRow label="Attendance" value="Not recorded" />
                  <DetailRow label="Shift" value={formatShift(result.shift)} />
                  <DetailRow label="Match confidence" value={`${result.confidence.toFixed(0)}%`} />
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{result.message}</p>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-500/10">
                  <AlertCircle className="size-8 text-rose-600" />
                </div>
                <StatusChip tone="error">Not verified</StatusChip>
                <p className="text-sm text-slate-700 leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full border-t border-slate-100 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Scan again
            </button>
          </div>
        ) : (
          <>
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
                  <RefreshCw className="size-8 animate-spin text-blue-400" />
                  <span className="text-sm font-semibold tracking-wide">
                    Hold still, checking in...
                  </span>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => captureAndPunch()}
              disabled={scanning || !cameraActive}
              className="w-full py-3.5 px-4 rounded-xl bg-[#047857] hover:bg-[#065f46] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <MapPin className="size-5" />
              {scanning ? "Checking in..." : "Check in / out"}
            </button>
          </>
        )}

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

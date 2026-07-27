"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  MapPin,
  Building2,
} from "@bop/icons";

export default function PublicMobileCheckInPage() {
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat?: number; lon?: number; accuracy?: number }>({});
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

  useEffect(() => {
    startCamera();
    obtainGeoLocation();
    return () => {
      stopCamera();
    };
  }, []);

  function obtainGeoLocation() {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn("Geolocation warning:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }

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

  async function captureAndPunch(fileToSubmit?: File) {
    let selfieBlob: Blob | undefined = fileToSubmit;

    if (!selfieBlob) {
      if (!videoRef.current || !cameraActive) {
        setErrorMessage("Webcam is not active. Please allow camera permissions.");
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
      setErrorMessage("Failed to capture selfie frame.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selfieBlob, "selfie.jpg");

    if (geoCoords.lat !== undefined && geoCoords.lon !== undefined) {
      formData.append("lat", String(geoCoords.lat));
      formData.append("lon", String(geoCoords.lon));
      if (geoCoords.accuracy !== undefined) {
        formData.append("accuracy", String(geoCoords.accuracy));
      }
    }

    try {
      const res = await fetch("/api/hr/attendance/checkin", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setScanning(false);

      if (res.ok) {
        setResult(data);
      } else {
        setErrorMessage(data.message || data.detail || "Selfie check-in failed.");
      }
    } catch (err) {
      setScanning(false);
      setErrorMessage(err instanceof Error ? err.message : "Network error during check-in.");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      captureAndPunch(file);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-emerald-400" />
          <span className="font-bold text-base tracking-wide text-white">WWE OS Attendance</span>
        </div>
        <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
          Mobile Kiosk
        </span>
      </header>

      {/* Main Viewfinder Card */}
      <main className="w-full max-w-md my-auto py-4 space-y-4">
        {/* Result Banner */}
        {result?.matched ? (
          <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 space-y-2 animate-in fade-in zoom-in-95 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-lg text-emerald-400">
              <CheckCircle2 className="size-6 text-emerald-400 shrink-0" />
              Marked {result.action || "PUNCH"} Successfully!
            </div>
            <p className="text-base font-semibold text-white">
              {result.employee_name} ({result.employee_code})
            </p>
            <p className="text-xs text-slate-300">{result.message || result.timestamp}</p>
          </div>
        ) : result && !result.matched ? (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs space-y-1">
            <p className="font-bold text-sm">Face Not Recognized</p>
            <p className="opacity-90">
              {result.message || "Position your face clearly inside the circle with good lighting."}
            </p>
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
            <div>{errorMessage}</div>
          </div>
        ) : null}

        {/* Camera Container */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-2xl flex items-center justify-center min-h-[320px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-80 object-cover rounded-xl border border-emerald-500/30 ${cameraActive ? "block" : "hidden"}`}
          />

          {!cameraActive ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <Camera className="size-12 text-slate-600" />
              <p className="text-xs max-w-xs">
                Allow camera permission to scan your face for mobile attendance.
              </p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="size-3.5" /> Enable Camera
              </button>
            </div>
          ) : (
            /* Face Oval Viewfinder Overlay */
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-56 rounded-full border-2 border-dashed border-emerald-400/90 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse" />
            </div>
          )}

          {scanning ? (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-400 space-y-2">
              <ScanFace className="size-12 animate-bounce text-emerald-400" />
              <span className="text-sm font-semibold tracking-wide">
                Matching Face Biometrics...
              </span>
            </div>
          ) : null}
        </div>

        {/* Location Indicator */}
        {geoCoords.lat !== undefined ? (
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <MapPin className="size-3 text-emerald-400" />
            <span>
              GPS Location Verified (
              {geoCoords.accuracy ? `±${Math.round(geoCoords.accuracy)}m` : "Active"})
            </span>
          </div>
        ) : null}

        {/* Main Punch Button */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => captureAndPunch()}
            disabled={scanning || !cameraActive}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <Camera className="size-5" />
            {scanning ? "Processing Face..." : "Scan Face & Mark Attendance"}
          </button>

          {/* Upload Backup */}
          <div className="text-center pt-1">
            <label className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
              <Upload className="size-3.5" /> Upload Selfie Photo Instead
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-2 text-[11px] text-slate-500 border-t border-slate-900">
        Waterworks Engineering OS · Biometric Attendance System
      </footer>
    </div>
  );
}

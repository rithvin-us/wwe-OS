"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, CheckCircle2, ScanFace, Upload, RefreshCw, Trash2, ShieldCheck } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { toast } from "sonner";
import { useFaceCapture } from "@/hooks/use-face-capture";

interface FaceStatus {
  enrolled: boolean;
  enrolled_at: string | null;
}

async function submitFace(file: Blob | File): Promise<FaceStatus> {
  const formData = new FormData();
  formData.append("file", file, "enroll.jpg");
  const res = await fetch("/api/auth/face/enroll", { method: "POST", body: formData });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message ?? "Face enrollment failed. Please try again.");
  }
  return body as FaceStatus;
}

export function FaceEnrollmentCard() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { cameraActive, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  // Load real enrollment status from the platform (auth.FaceCredential),
  // not a client-only guess — it must match what the login page can match.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/face/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FaceStatus | null) => {
        if (!cancelled) setStatus(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartWebcam = () => {
    setIsCapturing(true);
    startCamera();
  };

  const handleStopWebcam = () => {
    stopCamera();
    setIsCapturing(false);
  };

  const handleCaptureSnapshot = async () => {
    const burst = await captureBurst();
    if (!burst?.primary) {
      toast.error("Failed to capture face frame. Please ensure camera permission is enabled.");
      return;
    }
    setIsSaving(true);
    try {
      const next = await submitFace(burst.primary);
      setStatus(next);
      toast.success("Face ID profile enrolled.");
      handleStopWebcam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const next = await submitFace(file);
      setStatus(next);
      toast.success("Face photo uploaded and registered.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  const handleRemoveFace = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/auth/face/enroll", { method: "DELETE" });
      setStatus({ enrolled: false, enrolled_at: null });
      toast.info("Face ID profile removed.");
    } catch {
      toast.error("Could not remove face profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const enrolledAt = status?.enrolled_at
    ? new Date(status.enrolled_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <Card className="border border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScanFace className="size-5 text-primary" />
          Owner Face ID
        </CardTitle>
        <CardDescription>
          Enrol your face to sign in without a password. Verified with a live camera check each time
          you sign in — your photo is never stored, only a secure face template.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoadingStatus ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Checking face enrollment status…
          </div>
        ) : status?.enrolled ? (
          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-md dark:text-emerald-400">
              <ShieldCheck className="size-7" />
            </div>

            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="size-4" />
                <span>Touchless Login Ready</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your face template is registered
                {enrolledAt ? (
                  <>
                    {" "}
                    as of <span className="font-medium text-foreground">{enrolledAt}</span>
                  </>
                ) : null}
                . Use <span className="font-semibold text-foreground">Face Login</span> on the
                sign-in page — no email or password required.
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleStartWebcam}
                  disabled={isSaving}
                  className="gap-1"
                >
                  <RefreshCw className="size-3" /> Re-scan Face
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={handleRemoveFace}
                  disabled={isSaving}
                  className="gap-1"
                >
                  <Trash2 className="size-3" /> Remove Profile
                </Button>
              </div>
            </div>
          </div>
        ) : isCapturing ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 p-2 shadow-inner flex items-center justify-center min-h-[240px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-60 object-cover rounded-lg border border-primary/50"
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white p-4 text-center">
                  <Camera className="size-8 text-muted-foreground mb-2" />
                  <p className="text-xs">Initializing webcam...</p>
                </div>
              )}

              {isSaving && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white">
                  <ScanFace className="size-8 animate-pulse text-primary" />
                  <p className="text-xs font-medium">Verifying and saving your face template…</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleStopWebcam} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCaptureSnapshot}
                disabled={!cameraActive || isSaving}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                <ScanFace className="size-4" /> Capture & Enrol Face
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ScanFace className="size-6" />
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-sm">No Face Profile Registered</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Scan your face using your webcam or upload a photo to enable passwordless Owner
                login.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                onClick={handleStartWebcam}
                disabled={isSaving}
                className="gap-1.5 cursor-pointer"
              >
                <Camera className="size-4" /> Scan with Webcam
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="gap-1.5 cursor-pointer"
              >
                <Upload className="size-4" /> Upload Face Photo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

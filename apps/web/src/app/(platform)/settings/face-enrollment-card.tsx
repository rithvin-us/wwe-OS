"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, CheckCircle2, ScanFace, Upload, Trash2, Plus, UserCheck } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";
import { useFaceCapture } from "@/hooks/use-face-capture";

export interface FaceProfile {
  id: string;
  label: string;
  enrolled_at: string;
}

export interface FaceStatus {
  enrolled: boolean;
  count: number;
  credentials: FaceProfile[];
  enrolled_at: string | null;
}

async function submitFace(file: Blob | File, label: string): Promise<FaceStatus> {
  const formData = new FormData();
  formData.append("file", file, "enroll.jpg");
  if (label.trim()) {
    formData.append("label", label.trim());
  }
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
  const [faceLabel, setFaceLabel] = useState("");

  const { cameraActive, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/auth/face/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore status fetch errors
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
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
      const next = await submitFace(burst.primary, faceLabel);
      setStatus(next);
      setFaceLabel("");
      toast.success("New face profile enrolled!");
      handleStopWebcam();
      fetchStatus();
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
      const next = await submitFace(file, faceLabel || file.name.split(".")[0]);
      setStatus(next);
      setFaceLabel("");
      toast.success("Face photo uploaded and registered.");
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  const handleRemoveFace = async (id?: string) => {
    setIsSaving(true);
    try {
      const url = id ? `/api/auth/face/enroll?id=${id}` : "/api/auth/face/enroll";
      await fetch(url, { method: "DELETE" });
      toast.info("Face profile removed.");
      fetchStatus();
    } catch {
      toast.error("Could not remove face profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanFace className="size-5 text-primary" />
            Account Face ID Profiles
          </div>
          {status?.count ? (
            <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              {status.count} {status.count === 1 ? "Profile Enrolled" : "Profiles Enrolled"}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Enrol one or more face profiles (e.g. primary face, with glasses, alternate angles) to
          sign in without a password. Any of your enrolled faces will log you in securely.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoadingStatus ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Loading enrolled face profiles…
          </div>
        ) : (
          <div className="space-y-4">
            {/* List of Enrolled Profiles */}
            {status?.credentials && status.credentials.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Registered Face Profiles for your Account:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {status.credentials.map((cred, idx) => (
                    <div
                      key={cred.id || idx}
                      className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserCheck className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="truncate">
                          <p className="font-semibold text-foreground truncate">
                            {cred.label || `Face Profile #${idx + 1}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Enrolled {new Date(cred.enrolled_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleRemoveFace(cred.id)}
                        disabled={isSaving}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title="Delete face profile"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-2">
                <ScanFace className="size-8 mx-auto text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">No Face Profiles Registered</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Enrol your webcam face or photo to enable touchless login.
                </p>
              </div>
            )}

            {/* Add Face Section */}
            {isCapturing ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="face-label" className="text-xs">
                    Face Profile Label (e.g. "With Glasses", "Front View")
                  </Label>
                  <Input
                    id="face-label"
                    placeholder="e.g. With Glasses / Front View"
                    value={faceLabel}
                    onChange={(e) => setFaceLabel(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 p-2 shadow-inner flex items-center justify-center min-h-[220px]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-56 object-cover rounded-lg border border-primary/50"
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
                      <p className="text-xs font-medium">Enrolling face profile…</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStopWebcam}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCaptureSnapshot}
                    disabled={!cameraActive || isSaving}
                    className="bg-primary text-primary-foreground gap-1.5"
                  >
                    <CheckCircle2 className="size-4" /> Save Face Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Add Another Face Profile</p>
                  <p className="text-[11px] text-muted-foreground">
                    Enrol extra angles or looks for higher accuracy
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
                    className="gap-1.5 cursor-pointer text-xs"
                  >
                    <Upload className="size-3.5" /> Upload Photo
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleStartWebcam}
                    disabled={isSaving}
                    className="gap-1.5 cursor-pointer text-xs"
                  >
                    <Plus className="size-3.5" /> Enrol Face via Camera
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

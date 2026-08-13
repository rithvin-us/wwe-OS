"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

// Matches the backend's MAX_LIVENESS_FRAMES cap
// (modules/hr/backend/services/checkin.py) and the ~400ms spacing its
// liveness motion/blink analysis expects (services/face-ai/app/engine.py).
const BURST_FRAME_COUNT = 4;
const BURST_INTERVAL_MS = 400;
const GEOLOCATION_TIMEOUT_MS = 10_000;

export interface GeoFix {
  lat: number;
  lon: number;
  accuracy: number;
}

export interface FaceCaptureBurst {
  primary: Blob;
  frames: Blob[];
}

/**
 * Shared camera + liveness-burst + geolocation capture for the two
 * self-service check-in kiosks. Camera and geolocation permissions are
 * requested together on mount; geolocation failure is silent (soft signal —
 * see docs/superpowers/specs/2026-08-13-attendance-geo-burst-capture-design.md).
 */
export function useFaceCapture(videoRef: RefObject<HTMLVideoElement | null>) {
  const [cameraActive, setCameraActive] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    requestGeolocation();
    return () => stopCamera();
  }, []);

  function requestGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        console.warn("Geolocation unavailable:", err.message);
        setGeo(null);
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 0 },
    );
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 960 }, facingMode: "user" },
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

  function snapshot(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Captures one primary frame immediately, then a liveness burst of
   * additional frames ~400ms apart. A failed mid-burst snapshot is dropped
   * rather than aborting — a shorter burst still improves on a single frame.
   */
  async function captureBurst(): Promise<FaceCaptureBurst | null> {
    const primary = await snapshot();
    if (!primary) return null;

    const frames: Blob[] = [];
    for (let i = 1; i < BURST_FRAME_COUNT; i++) {
      await wait(BURST_INTERVAL_MS);
      const frame = await snapshot();
      if (frame) frames.push(frame);
    }

    return { primary, frames };
  }

  return { cameraActive, geo, startCamera, stopCamera, captureBurst };
}

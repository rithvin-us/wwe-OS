"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, ScanFace, ZoomIn, ZoomOut, RefreshCw, Move } from "@bop/icons";
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

import { enrollFace, revokeEnrollment } from "../../actions";

const CANVAS_SIZE = 300;

export function EnrollFaceDialog({
  employeeId,
  employeeName,
  isEnrolled,
}: {
  employeeId: string;
  employeeName: string;
  isEnrolled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  async function handleClearEnrollment() {
    setLoading(true);
    const res = await revokeEnrollment(employeeId);
    setLoading(false);
    if (res.ok) {
      toast.success(`Cleared face biometrics for ${employeeName}. Upload a fresh photo.`);
      setOpen(false);
    } else {
      toast.error(res.error || "Failed to clear face biometrics.");
    }
  }

  // Transform states
  const [zoom, setZoom] = useState(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImageObj(img);
        setZoom(1.0);
        setOffset({ x: 0, y: 0 });
      };
      img.src = url;
    }
  }

  // Draw crop preview on canvas whenever image, zoom, or offset changes
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Save context
    ctx.save();

    // Move to center
    ctx.translate(CANVAS_SIZE / 2 + offset.x, CANVAS_SIZE / 2 + offset.y);
    ctx.scale(zoom, zoom);

    // Calculate base draw dimensions fitting initial canvas size
    const scaleFactor = Math.max(CANVAS_SIZE / imageObj.width, CANVAS_SIZE / imageObj.height);
    const drawWidth = imageObj.width * scaleFactor;
    const drawHeight = imageObj.height * scaleFactor;

    ctx.drawImage(imageObj, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore();
  }, [imageObj, zoom, offset]);

  // Dragging handlers
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function resetCrop() {
    setZoom(1.0);
    setOffset({ x: 0, y: 0 });
  }

  async function handleUpload() {
    if (!imageObj) {
      toast.error("Please select a face photo to upload.");
      return;
    }

    setLoading(true);

    // Render offscreen canvas at high resolution (512x512)
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 512;
    exportCanvas.height = 512;
    const ctx = exportCanvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);

      const ratio = 512 / CANVAS_SIZE;
      ctx.translate(512 / 2 + offset.x * ratio, 512 / 2 + offset.y * ratio);
      ctx.scale(zoom, zoom);

      const scaleFactor = Math.max(512 / imageObj.width, 512 / imageObj.height);
      const drawWidth = imageObj.width * scaleFactor;
      const drawHeight = imageObj.height * scaleFactor;

      ctx.drawImage(imageObj, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }

    exportCanvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error("Failed to process cropped face image.");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", blob, "cropped_face.jpg");

        const res = await enrollFace(employeeId, formData);
        setLoading(false);

        if (res.ok) {
          toast.success(`Face photo enrolled successfully for ${employeeName}!`);
          setOpen(false);
          setSelectedFile(null);
          setImageObj(null);
        } else {
          toast.error(res.error || "Face enrollment failed.");
        }
      },
      "image/jpeg",
      0.95,
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={isEnrolled ? "outline" : "default"}
          className="gap-1.5 cursor-pointer"
        >
          <ScanFace className="size-4" />
          {isEnrolled ? "Re-enroll Face Photo" : "Upload Reference Photo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-5 text-emerald-600" />
            Enroll Face Biometrics — {employeeName}
          </DialogTitle>
          <DialogDescription>
            Position and zoom the face inside the circle outline below for optimal AI detection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {imageObj ? (
            <div className="flex flex-col items-center gap-3">
              {/* Interactive Canvas Viewfinder */}
              <div className="relative group rounded-xl overflow-hidden border border-border bg-slate-950 p-2 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="rounded-full cursor-grab active:cursor-grabbing border-2 border-emerald-500 shadow-lg"
                />

                {/* Overlay Instruction */}
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] text-white/90 backdrop-blur-xs">
                    <Move className="size-3" /> Drag to align face
                  </span>
                </div>
              </div>

              {/* Zoom Controls Slider */}
              <div className="w-full space-y-1.5 px-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <ZoomOut className="size-3.5" /> Zoom Out
                  </span>
                  <span>{Math.round(zoom * 100)}%</span>
                  <span className="flex items-center gap-1">
                    Zoom In <ZoomIn className="size-3.5" />
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-muted rounded-lg"
                />
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between w-full pt-1">
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
                  {selectedFile?.name}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={resetCrop}
                    className="gap-1 text-xs text-muted-foreground"
                  >
                    <RefreshCw className="size-3" /> Reset View
                  </Button>
                  <label className="text-xs text-emerald-600 hover:underline cursor-pointer font-medium">
                    Change Photo
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
              <Upload className="size-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Click to select portrait photo</span>
              <span className="text-xs text-muted-foreground mt-1">
                PNG or JPG (Front view profile photo)
              </span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            {isEnrolled ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearEnrollment}
                disabled={loading}
                className="text-xs cursor-pointer"
              >
                Clear Old Biometrics
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={loading || !imageObj}
                className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {loading ? "Processing AI Embedding..." : "Enroll Face Photo"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Camera,
  ScanFace,
  TriangleAlert,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "motion/react";
import { useFaceCapture } from "@/hooks/use-face-capture";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: standard password login vs touchless face login
  const [loginMethod, setLoginMethod] = useState<"password" | "face_id">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Face Login states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [faceMatchScanning, setFaceMatchScanning] = useState(false);
  const [faceSuccessMessage, setFaceSuccessMessage] = useState<string | null>(null);
  const [faceErrorMessage, setFaceErrorMessage] = useState<string | null>(null);
  const { cameraActive, startCamera, stopCamera, captureBurst } = useFaceCapture(videoRef);

  // Forgot password dialog state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  // Start/Stop camera when switching login methods
  useEffect(() => {
    if (loginMethod === "face_id") {
      startCamera();
    } else {
      stopCamera();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- camera start/stop is a real side effect; the message reset belongs with it
      setFaceSuccessMessage(null);
      setFaceErrorMessage(null);
    }
  }, [loginMethod]);

  const handleKeyDownPassword = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  async function onSubmitPassword(values: LoginValues) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      let message = "Incorrect email or password.";
      if (response.status === 429) {
        message = "Too many attempts. Please wait a few minutes before trying again.";
      } else if (response.status >= 500) {
        message =
          body?.message ?? "Backend service unavailable. Please ensure the server is running.";
      } else if (body?.message) {
        message = body.message;
      }
      setError("root", { message });
      return;
    }

    const next = searchParams.get("next") || "/";
    router.push(next);
    router.refresh();
  }

  // Touchless Face Login Handler (No email / password required) — a real 1:N
  // match against the platform's enrolled face templates (ArcFace, buffalo_l)
  // via /api/v1/auth/face/login/, not a client-only fake success.
  async function handleFaceLogin() {
    if (!videoRef.current || !cameraActive) {
      setFaceErrorMessage("Camera is inactive. Please allow camera permissions to scan.");
      return;
    }

    setFaceMatchScanning(true);
    setFaceErrorMessage(null);

    const burst = await captureBurst();
    if (!burst) {
      setFaceMatchScanning(false);
      setFaceErrorMessage("Failed to capture face frame. Ensure you are clearly visible.");
      return;
    }

    const formData = new FormData();
    formData.append("file", burst.primary, "login.jpg");
    burst.frames.forEach((frame, i) => formData.append("frames", frame, `frame-${i}.jpg`));

    try {
      const res = await fetch("/api/auth/face/login", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setFaceMatchScanning(false);
        setFaceErrorMessage(body?.message ?? "Face not recognized. Please try again.");
        return;
      }

      setFaceMatchScanning(false);
      setFaceSuccessMessage("Face matched. Signing you in");
      toast.success("Face verified");

      setTimeout(() => {
        const next = searchParams.get("next") || "/";
        router.push(next);
        router.refresh();
      }, 700);
    } catch {
      setFaceMatchScanning(false);
      setFaceErrorMessage("Network error while verifying your face. Please try again.");
    }
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) return;

    setIsResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setResetError(
          res.status === 429
            ? "Too many requests. Please wait a few minutes and try again."
            : (body?.message ?? "Couldn't send the reset link. Please try again."),
        );
        return;
      }
      setResetSent(true);
    } catch {
      setResetError("Network error. Please try again.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Login Method Selector (Password vs Touchless Face Login) */}
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setLoginMethod("password")}
          className={`flex h-8 items-center justify-center gap-2 rounded-sm transition-colors duration-(--duration-fast) ease-out-quart ${
            loginMethod === "password"
              ? "bg-background font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound aria-hidden className="size-4" />
          <span>Password</span>
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod("face_id")}
          className={`flex h-8 items-center justify-center gap-2 rounded-sm transition-colors duration-(--duration-fast) ease-out-quart ${
            loginMethod === "face_id"
              ? "bg-background font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScanFace aria-hidden className="size-4" />
          <span>Face</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loginMethod === "password" ? (
          <motion.form
            key="password-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit(onSubmitPassword)}
            className="space-y-4"
            noValidate
          >
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Mail className="size-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={!!errors.email}
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email ? (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Dialog
                  open={forgotPasswordOpen}
                  onOpenChange={(open) => {
                    setForgotPasswordOpen(open);
                    if (open) setResetError(null);
                  }}
                >
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reset password</DialogTitle>
                      <DialogDescription>
                        Enter your email address and we&apos;ll send you instructions to reset your
                        account password.
                      </DialogDescription>
                    </DialogHeader>

                    {resetSent ? (
                      <div className="space-y-4 py-4 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-success">
                          <CheckCircle2 aria-hidden className="size-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-foreground">Reset link sent</h4>
                          <p className="text-sm text-muted-foreground">
                            If an account exists for{" "}
                            <span className="font-medium text-foreground">{resetEmail}</span>, you
                            will receive an email shortly.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setResetSent(false);
                            setForgotPasswordOpen(false);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="you@company.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        {resetError ? (
                          <p
                            className="flex items-center gap-1.5 text-xs text-destructive"
                            role="alert"
                          >
                            <TriangleAlert className="size-3.5 shrink-0" />
                            {resetError}
                          </p>
                        ) : null}
                        <Button type="submit" className="w-full" disabled={isResetting}>
                          {isResetting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Send reset link"
                          )}
                        </Button>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="size-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  className="pl-9 pr-10"
                  onKeyDown={handleKeyDownPassword}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {capsLockOn && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-warning"
                >
                  <TriangleAlert className="size-3" />
                  <span>Caps Lock is on</span>
                </motion.div>
              )}

              {errors.password ? (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded-sm border-border accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Root Error Banner */}
            {errors.root ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive"
              >
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                <span>{errors.root.message}</span>
              </motion.p>
            ) : null}

            {/* Submit Button */}
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Sign in
            </Button>
          </motion.form>
        ) : (
          /* Touchless Face Login (no email or password input required) */
          <motion.div
            key="face-login-pane"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="space-y-4 rounded-lg border border-border p-5">
              <p className="text-sm text-muted-foreground">
                No email or password needed. Look directly into the camera — we&apos;ll verify
                it&apos;s really you and sign you in.
              </p>

              {/* Status alerts */}
              {faceSuccessMessage ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
                  <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
                  <span>{faceSuccessMessage}</span>
                </div>
              ) : faceErrorMessage ? (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                  <TriangleAlert aria-hidden className="size-4 shrink-0" />
                  <span>{faceErrorMessage}</span>
                </div>
              ) : null}

              {/* Camera Feed Viewfinder */}
              <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-md border border-border bg-muted p-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-56 w-full rounded-sm object-cover ${
                    cameraActive ? "block" : "hidden"
                  }`}
                />

                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center text-muted-foreground">
                    <Camera aria-hidden className="size-6" />
                    <p className="text-sm">Connecting to the camera</p>
                    <Button size="xs" variant="outline" onClick={startCamera} className="gap-1">
                      <RefreshCw aria-hidden className="size-3" /> Enable camera
                    </Button>
                  </div>
                )}

                {faceMatchScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-background/90 text-foreground">
                    <ScanFace aria-hidden className="size-8 text-muted-foreground" />
                    <span className="text-sm">Verifying your face</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <Button
                type="button"
                onClick={handleFaceLogin}
                disabled={faceMatchScanning || !cameraActive}
                className="h-10 w-full gap-2"
              >
                {faceMatchScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ScanFace className="size-4" />
                )}
                <span>Scan face and sign in</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  ArrowRight,
  RefreshCw,
  Sparkles,
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
  email: z.string().email("Enter a valid work email address."),
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
      setFaceSuccessMessage("Face Matched! Signing in touchlessly...");
      toast.success("Face Verified — Welcome Back!");

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

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) return;

    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
      setResetSent(true);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Login Method Selector (Password vs Touchless Face Login) */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-medium backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setLoginMethod("password")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 transition duration-(--duration-base) ease-out-quart cursor-pointer ${
            loginMethod === "password"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="size-3.5" />
          <span>Password Sign-In</span>
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod("face_id")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 transition duration-(--duration-base) ease-out-quart cursor-pointer ${
            loginMethod === "face_id"
              ? "bg-primary text-primary-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScanFace className="size-3.5" />
          <span>Face Login</span>
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
              <Label htmlFor="email" className="text-xs font-medium">
                Work Email
              </Label>
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
                  className="pl-9 transition focus-visible:ring-2 focus-visible:ring-primary/40"
                  {...register("email")}
                />
              </div>
              {errors.email ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <TriangleAlert className="size-3" />
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
                <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                      <DialogDescription>
                        Enter your work email address and we'll send you instructions to reset your
                        account password.
                      </DialogDescription>
                    </DialogHeader>

                    {resetSent ? (
                      <div className="space-y-4 py-4 text-center">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <CheckCircle2 className="size-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-foreground">Reset Link Sent</h4>
                          <p className="text-xs text-muted-foreground">
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
                          <Label htmlFor="reset-email">Work Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="you@company.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={isResetting}>
                          {isResetting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Send Reset Link"
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
                  className="pl-9 pr-10 transition focus-visible:ring-2 focus-visible:ring-primary/40"
                  onKeyDown={handleKeyDownPassword}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {capsLockOn && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                >
                  <TriangleAlert className="size-3" />
                  <span>Caps Lock is ON</span>
                </motion.div>
              )}

              {errors.password ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <TriangleAlert className="size-3" />
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary/40 accent-primary"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Root Error Banner */}
            {errors.root ? (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive flex items-center gap-2"
              >
                <TriangleAlert className="size-4 shrink-0" />
                <span>{errors.root.message}</span>
              </motion.p>
            ) : null}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-10 font-semibold shadow-md transition active:scale-[0.99] cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 aria-hidden className="size-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="size-4 mr-2" />
              )}
              Sign In to Employee Portal
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
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                <span>Touchless Face Login</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No email or password needed. Look directly into the camera — we&apos;ll verify
                it&apos;s really you and sign you in.
              </p>

              {/* Status alerts */}
              {faceSuccessMessage ? (
                <div className="p-3 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="size-4" />
                  <span>{faceSuccessMessage}</span>
                </div>
              ) : faceErrorMessage ? (
                <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs font-medium flex items-center justify-center gap-2">
                  <TriangleAlert className="size-4 shrink-0" />
                  <span>{faceErrorMessage}</span>
                </div>
              ) : null}

              {/* Camera Feed Viewfinder */}
              <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 p-2 shadow-inner flex items-center justify-center min-h-[220px]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-56 object-cover rounded-lg border border-primary/50 ${
                    cameraActive ? "block" : "hidden"
                  }`}
                />

                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400 space-y-2">
                    <Camera className="size-8 text-slate-500" />
                    <p className="text-xs">Connecting to camera feed...</p>
                    <Button size="xs" variant="outline" onClick={startCamera} className="gap-1">
                      <RefreshCw className="size-3" /> Enable Camera
                    </Button>
                  </div>
                )}

                {faceMatchScanning && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-primary space-y-2">
                    <ScanFace className="size-10 animate-pulse" />
                    <span className="text-xs font-semibold">Verifying your face...</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <Button
                type="button"
                onClick={handleFaceLogin}
                disabled={faceMatchScanning || !cameraActive}
                className="w-full h-10 font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer"
              >
                {faceMatchScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ScanFace className="size-4" />
                )}
                <span>Scan Face & Sign In</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

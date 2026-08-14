"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { Lock, KeyRound, ShieldCheck, Save, Eye, EyeOff } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/(platform)/settings/actions";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current_password") ?? "");
    const next = String(form.get("new_password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (next.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction({ current_password: current, new_password: next });
      if (result.ok) {
        toast.success(result.message);
        formRef.current?.reset();
        setNewPassword("");
      } else {
        toast.error(result.message);
      }
    });
  }

  // Password strength indicators
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-semibold text-foreground">Password Security Policy</h4>
          <p className="text-muted-foreground leading-relaxed">
            Changing your password terminates active sessions on other devices. Use at least 8
            characters with numbers and special symbols for maximum security.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="s-current" className="text-xs font-semibold flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            Current Password
          </Label>
          <Input
            id="s-current"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className="text-xs font-mono"
            placeholder="Enter your current account password"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="s-new" className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              New Password
            </Label>
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            id="s-new"
            name="new_password"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="text-xs font-mono"
            placeholder="Min. 8 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="s-confirm" className="text-xs font-semibold flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            Confirm New Password
          </Label>
          <Input
            id="s-confirm"
            name="confirm"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            required
            className="text-xs font-mono"
            placeholder="Re-type new password"
          />
        </div>
      </div>

      {/* Password Strength Checks */}
      {newPassword ? (
        <div className="flex flex-wrap gap-3 text-[11px] font-mono p-3 rounded-lg border border-border/40 bg-muted/20">
          <span
            className={hasMinLength ? "text-emerald-400 font-semibold" : "text-muted-foreground"}
          >
            {hasMinLength ? "✓ 8+ Characters" : "○ 8+ Characters"}
          </span>
          <span className={hasNumber ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
            {hasNumber ? "✓ Number Included" : "○ Number Included"}
          </span>
          <span className={hasSpecial ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
            {hasSpecial ? "✓ Special Symbol" : "○ Special Symbol"}
          </span>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end pt-2 border-t border-border/40">
        <Button
          type="submit"
          disabled={pending}
          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          {pending ? "Updating..." : "Update Account Password"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { Eye, EyeOff } from "@bop/icons";
import { toast } from "sonner";
import type { TenantConfig } from "@/lib/maintenance";
import { updateTenantConfigAction } from "./actions";

export function ConfigForm({
  config,
  telegramBillsCount,
  notificationsSentCount,
}: {
  config: TenantConfig;
  telegramBillsCount?: number | null;
  notificationsSentCount?: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await updateTenantConfigAction({
        config: {
          ...config,
          gemini_api_key: fd.get("gemini_api_key") as string,
          ocr_model: (fd.get("ocr_model") as string) || "gemini-flash-latest",
          openai_api_key: fd.get("openai_api_key") as string,
          telegram_bot_token: fd.get("telegram_bot_token") as string,
          telegram_chat_id: fd.get("telegram_chat_id") as string,
          smtp_host: fd.get("smtp_host") as string,
          smtp_port: fd.get("smtp_port") as string,
          smtp_user: fd.get("smtp_user") as string,
          smtp_password: fd.get("smtp_password") as string,
          smtp_from: fd.get("smtp_from") as string,
        },
      });
      if (res.success) {
        router.refresh();
        toast.success("API Keys and AI Provider configuration saved.");
      } else {
        toast.error(`Failed to save configuration: ${res.error}`);
      }
    } catch (err: unknown) {
      toast.error(
        `Failed to save configuration: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Gemini API Key */}
      <div className="space-y-1.5">
        <Label htmlFor="gemini_api_key">Google Gemini API Key</Label>
        <div className="relative flex items-center">
          <Input
            id="gemini_api_key"
            name="gemini_api_key"
            type={showGeminiKey ? "text" : "password"}
            placeholder="AIzaSy..."
            defaultValue={(config?.gemini_api_key as string) ?? ""}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            title={showGeminiKey ? "Hide API Key" : "Show API Key"}
          >
            {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Primary vision and OCR model provider key for document and receipt extraction.
        </p>
      </div>

      {/* OCR Model Selection */}
      <div className="space-y-1.5">
        <Label htmlFor="ocr_model">Vision OCR Engine Model</Label>
        <select
          id="ocr_model"
          name="ocr_model"
          defaultValue={(config?.ocr_model as string) || "gemini-flash-latest"}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="gemini-flash-latest">Gemini Flash Latest (Recommended)</option>
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (pinned — may be retired)</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro (pinned — may be retired)</option>
          <option value="gemini-1.5-flash">Gemini 1.5 Flash (pinned — may be retired)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Selects the default multimodal vision model used for receipts and scanned bills. Google
          retires dated snapshots (2.0-flash, 1.5-*) without notice — &quot;-latest&quot; tracks
          whatever is currently live and won&apos;t 404 out from under you.
        </p>
      </div>

      {/* OpenAI API Key */}
      <div className="space-y-1.5">
        <Label htmlFor="openai_api_key">OpenAI API Key</Label>
        <div className="relative flex items-center">
          <Input
            id="openai_api_key"
            name="openai_api_key"
            type={showOpenAIKey ? "text" : "password"}
            placeholder="sk-..."
            defaultValue={(config?.openai_api_key as string) ?? ""}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            title={showOpenAIKey ? "Hide API Key" : "Show API Key"}
          >
            {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Secondary fallback for text summarization and AI gateway models.
        </p>
      </div>

      {/* Telegram Bot */}
      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <Label>Telegram Bot</Label>
          <p className="text-xs text-muted-foreground">
            Powers bill intake and outbound alerts.
            {telegramBillsCount ? ` ${telegramBillsCount} bill(s) received so far.` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telegram_bot_token">Bot Token</Label>
          <div className="relative flex items-center">
            <Input
              id="telegram_bot_token"
              name="telegram_bot_token"
              type={showTelegramToken ? "text" : "password"}
              placeholder="123456:ABC-DEF..."
              defaultValue={(config?.telegram_bot_token as string) ?? ""}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowTelegramToken(!showTelegramToken)}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              title={showTelegramToken ? "Hide token" : "Show token"}
            >
              {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telegram_chat_id">Alert Chat ID</Label>
          <Input
            id="telegram_chat_id"
            name="telegram_chat_id"
            placeholder="-1001234567890"
            defaultValue={(config?.telegram_chat_id as string) ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Where alerts are delivered. Message the bot, then check its /getUpdates response for
            this chat&apos;s id.
          </p>
        </div>
      </div>

      {/* Email (SMTP) */}
      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <Label>Email (SMTP)</Label>
          <p className="text-xs text-muted-foreground">
            Sends platform notifications and reports by email.
            {notificationsSentCount
              ? ` ${notificationsSentCount} notification(s) sent so far.`
              : ""}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtp_host">SMTP Host</Label>
            <Input
              id="smtp_host"
              name="smtp_host"
              placeholder="smtp.gmail.com"
              defaultValue={(config?.smtp_host as string) ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input
              id="smtp_port"
              name="smtp_port"
              type="number"
              placeholder="587"
              defaultValue={(config?.smtp_port as string) ?? ""}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_user">SMTP Username</Label>
          <Input
            id="smtp_user"
            name="smtp_user"
            placeholder="you@company.com"
            defaultValue={(config?.smtp_user as string) ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_password">SMTP Password</Label>
          <div className="relative flex items-center">
            <Input
              id="smtp_password"
              name="smtp_password"
              type={showSmtpPassword ? "text" : "password"}
              placeholder="App password or SMTP key"
              defaultValue={(config?.smtp_password as string) ?? ""}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              title={showSmtpPassword ? "Hide password" : "Show password"}
            >
              {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp_from">From Address</Label>
          <Input
            id="smtp_from"
            name="smtp_from"
            placeholder="notifications@yourcompany.com"
            defaultValue={(config?.smtp_from as string) ?? ""}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving Configuration..." : "Save Configuration"}
        </Button>
      </div>
    </form>
  );
}

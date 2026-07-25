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

export function ConfigForm({ config }: { config: TenantConfig }) {
  const [loading, setLoading] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
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
          ocr_model: (fd.get("ocr_model") as string) || "gemini-2.0-flash",
          openai_api_key: fd.get("openai_api_key") as string,
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
          defaultValue={(config?.ocr_model as string) || "gemini-2.0-flash"}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended — Fast & Accurate)</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Highest Accuracy for Scans)</option>
          <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard Baseline)</option>
          <option value="gemini-flash-latest">Gemini Flash Latest</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Selects the default multimodal vision model used for receipts and scanned bills.
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

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving Configuration..." : "Save Configuration"}
        </Button>
      </div>
    </form>
  );
}

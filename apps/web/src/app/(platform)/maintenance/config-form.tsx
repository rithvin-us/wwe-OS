"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import type { TenantConfig } from "@/lib/maintenance";
import { updateTenantConfigAction } from "./actions";

export function ConfigForm({ config }: { config: TenantConfig }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await updateTenantConfigAction({
        config: {
          ...config,
          openai_api_key: fd.get("openai_api_key") as string,
        },
      });
      if (res.success) {
        router.refresh();
        alert("Configuration saved successfully.");
      } else {
        alert(`Failed to save configuration: ${res.error}`);
      }
    } catch (err: unknown) {
      alert(
        `Failed to save configuration: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="openai_api_key">OpenAI API Key</Label>
        <Input
          id="openai_api_key"
          name="openai_api_key"
          type="password"
          placeholder="sk-..."
          defaultValue={config?.openai_api_key ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Used for AI features. Ensure your subscription is active.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </form>
  );
}

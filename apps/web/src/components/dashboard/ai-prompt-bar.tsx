"use client";

import { useState } from "react";
import { Send } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";

/**
 * One-line question box for Rithu AI, backed by the platform AI gateway.
 *
 * A failed call says it failed. The previous version answered an unreachable
 * API with an invented summary ("July spend is ₹94.5K…"), which reads exactly
 * like a real answer — fabricated figures are a hard fail (design bible §11),
 * most of all on a surface used to make decisions.
 */
export function AiPromptBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = prompt.trim();
    if (!query) return;

    setLoading(true);
    setAnswer(null);
    setFailure(null);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query }),
      });
      const data = await res.json();

      if (res.ok && data.text) {
        setAnswer(data.text);
      } else {
        setFailure(data?.message ?? "The assistant couldn't answer that just now.");
      }
    } catch {
      setFailure("The assistant is unreachable. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          placeholder="Ask about spend, attendance, or documents"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-9 flex-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={loading || !prompt.trim()} aria-label="Ask">
          <Send aria-hidden className="size-4" />
        </Button>
      </form>

      <div aria-live="polite">
        {loading ? <p className="text-sm text-muted-foreground">Asking the assistant…</p> : null}

        {answer ? (
          <div className="animate-in fade-in rounded-md border border-border bg-muted/40 p-4 duration-(--duration-base) ease-out-quart">
            <p className="text-sm leading-relaxed text-foreground">{answer}</p>
          </div>
        ) : null}

        {failure ? <p className="text-sm text-warning">{failure}</p> : null}
      </div>
    </div>
  );
}

"use client";

import { ArrowRight, FileSearch, Loader2, Sparkles } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import Link from "next/link";
import { useState } from "react";

import { indexLabel } from "@/config/search";

interface Source {
  title: string;
  url: string;
  index: string;
  excerpt: string;
}

interface Answer {
  answer: string;
  sources: Source[];
  grounded: boolean;
}

const EXAMPLES = [
  "Show unpaid invoices",
  "Which contracts expire soon?",
  "Which sites are SEZ?",
  "Find customer",
];

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The assistant is unavailable.");
      } else {
        setResult(data as Answer);
      }
    } catch {
      setError("The assistant is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex gap-2"
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your invoices, customers, sites, contracts, documents…"
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
          Ask
        </Button>
      </form>

      {!result && !loading && !error ? (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              size="sm"
              variant="secondary"
              onClick={() => {
                setQuestion(example);
                void ask(example);
              }}
            >
              {example}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles aria-hidden className="size-3.5" />
              Answer
              {result.grounded ? (
                <Badge variant="success" className="text-[10px]">
                  Grounded in your data
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  No matching records
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {result.answer}
            </p>
          </div>

          {result.sources.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Sources</p>
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {result.sources.map((source, index) => (
                  <Link
                    key={`${source.index}-${index}`}
                    href={source.url || "/search"}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <FileSearch
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {indexLabel(source.index)}
                        {source.excerpt ? ` · ${source.excerpt}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

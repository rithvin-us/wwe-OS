"use client";

import { useState, useTransition } from "react";

import { Download, ShieldCheck, ShieldX } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";

import { MONTH_NAMES, type GenerationLog } from "@/lib/hr-constants";

import { verifyRegister } from "../actions";

type VerifyState = Record<string, "checking" | "valid" | "invalid" | "error">;

/**
 * Generation history. Each row is a filed submission: its version, when it was
 * produced, and its SHA-256 fingerprint. "Verify" re-hashes the archived bytes
 * against that fingerprint, which is how you prove to an inspector that a
 * workbook has not been altered since it was filed.
 */
export function RegisterHistory({ registers }: { registers: GenerationLog[] }) {
  const [state, setState] = useState<VerifyState>({});
  const [, startTransition] = useTransition();

  function verify(id: string) {
    setState((current) => ({ ...current, [id]: "checking" }));
    startTransition(async () => {
      const result = await verifyRegister(id);
      setState((current) => ({
        ...current,
        [id]: !result.ok ? "error" : result.valid ? "valid" : "invalid",
      }));
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium">Version</th>
            <th className="px-3 py-2 font-medium">Generated</th>
            <th className="px-3 py-2 font-medium">By</th>
            <th className="px-3 py-2 font-medium">Fingerprint</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {registers.map((log) => {
            const status = state[log.id];
            return (
              <tr key={log.id} className="border-t border-border/60 hover:bg-accent/50">
                <td className="px-3 py-2 font-medium">
                  {MONTH_NAMES[log.month - 1]} {log.year}
                </td>
                <td className="px-3 py-2 tabular-nums">v{log.version}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(log.generated_at).toLocaleString("en-IN")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{log.generated_by_name || "—"}</td>
                <td className="px-3 py-2">
                  <code className="font-mono text-[10px] text-muted-foreground">
                    {log.file_hash.slice(0, 16)}…
                  </code>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    {status === "valid" ? (
                      <Badge variant="success" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Unaltered
                      </Badge>
                    ) : status === "invalid" ? (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldX className="h-3 w-3" />
                        Altered
                      </Badge>
                    ) : status === "error" ? (
                      <Badge variant="outline">Check failed</Badge>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => verify(log.id)}
                      disabled={status === "checking"}
                    >
                      {status === "checking" ? "Checking…" : "Verify"}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/hr/registers/${log.id}/download`}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

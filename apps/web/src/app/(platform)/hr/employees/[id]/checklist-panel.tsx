"use client";

import { useState, useTransition } from "react";

import { Check, RotateCcw } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";

import type { EmployeeTask } from "@/lib/hr-constants";

import { completeTask, reopenTask } from "../../actions";

/** A joiner/leaver checklist. Items are generated from the templates that were
 * active when the employee joined or left, so ticking one off never rewrites
 * what was originally required. */
export function ChecklistPanel({ title, tasks }: { title: string; tasks: EmployeeTask[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = tasks.filter((task) => task.status === "completed").length;

  function toggle(task: EmployeeTask) {
    setError(null);
    startTransition(async () => {
      const result =
        task.status === "completed" ? await reopenTask(task.id) : await completeTask(task.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {tasks.length} done
        </span>
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    task.status === "completed"
                      ? "text-sm font-medium text-muted-foreground line-through"
                      : "text-sm font-medium"
                  }
                >
                  {task.title}
                </span>
                {task.department ? (
                  <Badge variant="outline" className="text-[10px]">
                    {task.department}
                  </Badge>
                ) : null}
              </div>
              {task.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
              ) : null}
              {task.due_date ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Due {task.due_date}</p>
              ) : null}
            </div>

            <Button
              variant={task.status === "completed" ? "ghost" : "outline"}
              size="sm"
              onClick={() => toggle(task)}
              disabled={pending}
              className="shrink-0"
            >
              {task.status === "completed" ? (
                <>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reopen
                </>
              ) : (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Done
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

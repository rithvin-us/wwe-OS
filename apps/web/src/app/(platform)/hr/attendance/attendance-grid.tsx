"use client";

import { useMemo, useState, useTransition } from "react";

import { Lock, Save } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import {
  ATTENDANCE_CODES,
  SHIFT_NAMES,
  type AttendanceGrid,
  type ShiftCode,
} from "@/lib/hr-constants";

import { saveAttendance, type AttendanceDayInput } from "../actions";

/**
 * The monthly attendance grid.
 *
 * The cell value encodes the shift for present days exactly as the legacy app
 * did — `P-G` / `P-M` / `P-E` / `P-N` — and is split back into
 * `status: "P"` + `shift` on save. That encoding is not cosmetic: the shift
 * actually worked can differ day to day, and it drives worked hours and daily
 * overtime, which the backend computes and stores per day.
 */

const SHIFT_CODES: ShiftCode[] = ["G", "M", "E", "N"];

/** Present-with-shift options, then every non-present code. */
const CELL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  ...SHIFT_CODES.map((shift) => ({
    value: `P-${shift}`,
    label: `P-${shift} · ${SHIFT_NAMES[shift]}`,
  })),
  ...Object.entries(ATTENDANCE_CODES)
    .filter(([code]) => code !== "P")
    .map(([code, label]) => ({ value: code, label: `${code} · ${label}` })),
];

/** "P-G" → { status: "P", shift: "G" }; "CL" → { status: "CL" }. */
function decodeCell(value: string): { status: string; shift?: ShiftCode } {
  if (value.startsWith("P-")) {
    return { status: "P", shift: value.slice(2) as ShiftCode };
  }
  return { status: value };
}

function encodeCell(status: string, shift: ShiftCode): string {
  if (!status) return "";
  return status === "P" ? `P-${shift}` : status;
}

type Edits = Record<string, Record<number, string>>;

export function AttendanceGridEditor({ grid, locked }: { grid: AttendanceGrid; locked: boolean }) {
  const [edits, setEdits] = useState<Edits>({});
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = useMemo(
    () => new Date(grid.year, grid.month, 0).getDate(),
    [grid.year, grid.month],
  );
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => index + 1),
    [daysInMonth],
  );

  const dirtyCount = Object.values(edits).reduce((sum, row) => sum + Object.keys(row).length, 0);

  function cellValue(employeeId: string, day: number, fallbackShift: ShiftCode): string {
    const edited = edits[employeeId]?.[day];
    if (edited !== undefined) return edited;
    const row = grid.rows.find((r) => r.employee_id === employeeId);
    const stored = row?.days[String(day)];
    if (!stored) return "";
    return encodeCell(stored.status, (stored.shift || fallbackShift) as ShiftCode);
  }

  function setCell(employeeId: string, day: number, value: string) {
    setMessage(null);
    setEdits((current) => ({
      ...current,
      [employeeId]: { ...(current[employeeId] ?? {}), [day]: value },
    }));
  }

  function save() {
    setError(null);
    setMessage(null);
    const records = Object.entries(edits)
      .map(([employeeId, dayMap]) => ({
        employee_id: employeeId,
        days: Object.entries(dayMap).map(([day, value]) => {
          const decoded = decodeCell(value);
          const input: AttendanceDayInput = { day: Number(day), status: decoded.status };
          if (decoded.shift) input.shift = decoded.shift;
          return input;
        }),
      }))
      .filter((record) => record.days.length > 0);

    if (records.length === 0) return;

    startTransition(async () => {
      const result = await saveAttendance({ year: grid.year, month: grid.month, records });
      if (result.ok) {
        setEdits({});
        setMessage("Attendance saved.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              This month&apos;s registers have been generated, so attendance is frozen. Unlock the
              period to make a correction.
            </span>
          ) : dirtyCount > 0 ? (
            `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}`
          ) : (
            "Pick a code per day. Present days take the shift's standard timings."
          )}
        </div>
        <Button onClick={save} disabled={locked || pending || dirtyCount === 0}>
          <Save className="mr-1 h-4 w-4" />
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                Employee
              </th>
              {days.map((day) => (
                <th key={day} className="px-1 py-2 text-center font-medium tabular-nums">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.employee_id} className="border-t border-border/60">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal whitespace-nowrap"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {row.employee_code}
                  </span>
                  <br />
                  <span className="font-medium">{row.employee_name}</span>
                </th>
                {days.map((day) => {
                  const value = cellValue(row.employee_id, day, row.shift);
                  const isDirty = edits[row.employee_id]?.[day] !== undefined;
                  const stored = row.days[String(day)];
                  const flagged = stored?.late_entry || stored?.early_exit;
                  return (
                    <td key={day} className="p-0.5">
                      <select
                        value={value}
                        onChange={(event) => setCell(row.employee_id, day, event.target.value)}
                        disabled={locked}
                        aria-label={`${row.employee_name}, day ${day}`}
                        title={
                          stored
                            ? [
                                stored.in_time && stored.out_time
                                  ? `${stored.in_time}–${stored.out_time}`
                                  : null,
                                stored.worked_hours != null
                                  ? `${stored.worked_hours}h worked`
                                  : null,
                                stored.ot_hours ? `${stored.ot_hours}h OT` : null,
                                stored.late_entry ? "Late entry" : null,
                                stored.early_exit ? "Early exit" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : undefined
                        }
                        className={[
                          "w-[3.25rem] rounded border bg-transparent px-1 py-1 text-center text-[11px] tabular-nums",
                          isDirty ? "border-primary" : "border-border/60",
                          flagged ? "text-warning" : "",
                          locked ? "cursor-not-allowed opacity-70" : "",
                        ].join(" ")}
                      >
                        {CELL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value || "—"}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">What the codes mean</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {CELL_OPTIONS.filter((option) => option.value).map((option) => (
            <li key={option.value}>{option.label}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

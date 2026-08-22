"use client";

import { getTargetSundayString } from "@/lib/sunday";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

function shiftSunday(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function formatSunday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function WeekPicker({ value, onChange }: WeekPickerProps) {
  const currentSunday = getTargetSundayString();
  const isCurrent = value === currentSunday;
  const isFuture = value > currentSunday;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(shiftSunday(value, -1))}
        className="p-1.5 rounded-md transition-colors hover:opacity-80"
        style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        title="Previous week"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="text-center min-w-[220px]">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {formatSunday(value)}
        </p>
        <p className="text-xs" style={{ color: isCurrent ? "var(--accent)" : "var(--text-muted)" }}>
          {isCurrent ? "Current week" : isFuture ? "Future week" : "Past week (read-only)"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftSunday(value, 1))}
        className="p-1.5 rounded-md transition-colors hover:opacity-80"
        style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        title="Next week"
      >
        <ChevronRight size={16} />
      </button>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentSunday)}
          className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
          style={{ color: "var(--accent)", background: "var(--accent-subtle)" }}
        >
          Today
        </button>
      )}
    </div>
  );
}

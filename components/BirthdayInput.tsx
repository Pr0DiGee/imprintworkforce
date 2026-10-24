"use client";

import { useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Birthday as day + month only (no year: people needn't share their age).
 * Submits a hidden form field `name` with "MM-DD", or "" if not chosen.
 * Accepts an older "YYYY-MM-DD" default value and drops the year.
 */
export function BirthdayInput({
  name = "birthday",
  defaultValue,
  className,
  style,
}: {
  name?: string;
  defaultValue?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const initial = /(\d{2})-(\d{2})$/.exec(defaultValue ?? "");
  const [month, setMonth] = useState(initial ? String(Number(initial[1])) : "");
  const [day, setDay] = useState(initial ? String(Number(initial[2])) : "");

  const maxDay = month ? MONTH_DAYS[Number(month) - 1] : 31;
  const value = month && day ? `${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";

  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <select
        aria-label="Birthday day"
        value={day}
        onChange={(e) => setDay(e.target.value)}
        className={className}
        style={style}
      >
        <option value="">Day</option>
        {Array.from({ length: maxDay }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
        ))}
      </select>
      <select
        aria-label="Birthday month"
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          if (e.target.value && Number(day) > MONTH_DAYS[Number(e.target.value) - 1]) setDay("");
        }}
        className={className}
        style={style}
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1)}>{m}</option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** "MM-DD" (or older "YYYY-MM-DD") → "4 March"; "" if empty. */
export function formatBirthday(value?: string | null): string {
  const m = /(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : "";
}

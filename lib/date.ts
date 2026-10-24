import {
  startOfWeek,
  addWeeks,
  addDays,
  format,
  parseISO,
  isBefore,
  isAfter,
  isSameDay,
} from "date-fns";

/**
 * Get the target Sunday string (YYYY-MM-DD) for the current service week.
 *
 * Logic: If today is Sunday, return today.
 * If today is Mon–Sat, return the most recent (previous) Sunday.
 *
 * This reflects the "current service window" — from Sunday through the
 * following Saturday, the target Sunday is the start of that window.
 */
export function getTargetSundayString(now: Date = new Date()): string {
  // Use the church's date (Lagos), not the server's: Vercel runs in UTC, which
  // is still Saturday during the first hour of Sunday in Lagos.
  const { date } = getLagosToday(now);
  const sunday = startOfWeek(parseISO(date), { weekStartsOn: 0 });
  return format(sunday, "yyyy-MM-dd");
}

/**
 * Format a target sunday string into a human-readable date.
 * e.g. "2026-08-23" → "Sunday, 23 Aug 2026"
 */
export function formatTargetSunday(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, "EEEE, d MMM yyyy");
}

/**
 * Get the Monday of the week for a given Sunday string.
 * e.g. Sunday 2026-08-23 → Monday 2026-08-24
 * (The devotion week runs Mon→Sat after the Sunday)
 */
export function getMondayOfWeek(sundayStr: string): string {
  const sunday = parseISO(sundayStr);
  return format(addDays(sunday, 1), "yyyy-MM-dd");
}

/**
 * Get an array of Mon→Sat date strings for a given Monday.
 */
export function getMonToSatDates(mondayStr: string): string[] {
  const monday = parseISO(mondayStr);
  return Array.from({ length: 6 }, (_, i) =>
    format(addDays(monday, i), "yyyy-MM-dd")
  );
}

/**
 * Add weeks to a date string and return the new date string.
 */
export function addWeeksToDate(dateStr: string, weeks: number): string {
  return format(addWeeks(parseISO(dateStr), weeks), "yyyy-MM-dd");
}

/**
 * Get a short label for a date (day-of-week abbreviation and day number).
 */
export function getShortDayLabel(dateStr: string): {
  dow: string;
  num: string;
} {
  const date = parseISO(dateStr);
  return {
    dow: format(date, "EEE"), // Mon, Tue, etc.
    num: format(date, "d"),
  };
}

/**
 * Format a date string as "d MMM" (e.g. "23 Aug").
 */
export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM");
}

/**
 * Check if a date string is before today.
 */
export function isDateBefore(dateStr: string, referenceStr: string): boolean {
  return isBefore(parseISO(dateStr), parseISO(referenceStr));
}

/**
 * Format a check-in date relatively.
 * If today -> "Today"
 * If < 7 days -> Day of week (e.g. "Monday")
 * Else -> "dd-MM-yyyy" (e.g. "01-09-2026")
 */
export function formatRelativeCheckInDate(dateStr: string | Date | number | null | undefined): string {
  if (!dateStr) return "Never";
  
  const date = new Date(dateStr);
  const now = new Date();
  
  // Set times to midnight to calculate day differences properly
  const dateMid = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = nowMid.getTime() - dateMid.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return format(date, "EEEE");
  }
  
  return format(date, "dd-MM-yyyy");
}

/**
 * Read a date in any shape the app may hold — ISO string, Date, Firestore
 * Timestamp, or a serialised `{_seconds}` / `{seconds}` object.
 * Returns null for missing or invalid values (never an "Invalid Date").
 */
export function toJsDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (typeof value === "object") {
    const v = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof v.toDate === "function") date = v.toDate();
    else if (typeof v._seconds === "number") date = new Date(v._seconds * 1000);
    else if (typeof v.seconds === "number") date = new Date(v.seconds * 1000);
  }
  return date && !isNaN(date.getTime()) ? date : null;
}

/**
 * Today's date (YYYY-MM-DD) and whether it's Sunday, in church time (Lagos),
 * regardless of the server's timezone (Vercel runs in UTC).
 */
export function getLagosToday(now: Date = new Date()): { date: string; isSunday: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    isSunday: get("weekday") === "Sun",
  };
}

export { parseISO, format, isBefore, isAfter, isSameDay };

/** The Monday that starts the current check-up week (Mon–Sun), in Lagos time. */
export function getCurrentWeekMonday(now: Date = new Date()): string {
  const { date } = getLagosToday(now);
  const d = parseISO(date);
  const sinceMonday = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return format(addDays(d, -sinceMonday), "yyyy-MM-dd");
}

/** A moment on a given date at a given hour, Lagos time (UTC+1, no daylight saving). */
export function lagosTime(date: string, hour: number, minute = 0): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`);
}

/**
 * Deadlines for the weekly to-dos, all relative to the target Sunday:
 * report and feedback by Monday 8pm, follow-ups by Wednesday 8pm.
 */
export function weeklyDeadlines(targetSunday: string) {
  return {
    report: lagosTime(format(addDays(parseISO(targetSunday), 1), "yyyy-MM-dd"), 20),
    feedback: lagosTime(format(addDays(parseISO(targetSunday), 1), "yyyy-MM-dd"), 20),
    followUp: lagosTime(format(addDays(parseISO(targetSunday), 3), "yyyy-MM-dd"), 20),
  };
}

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
export function getTargetSundayString(): string {
  const now = new Date();
  // startOfWeek with weekStartsOn: 0 gives us Sunday
  const sunday = startOfWeek(now, { weekStartsOn: 0 });
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

export { parseISO, format, isBefore, isAfter, isSameDay };

/**
 * Re-export all date/sunday utilities from the consolidated date module.
 * This file exists for backwards compatibility — all new code should
 * import directly from "@/lib/date".
 */
export {
  getTargetSundayString,
  formatTargetSunday,
  getMondayOfWeek,
  getMonToSatDates,
  addWeeksToDate,
  getShortDayLabel,
  formatShortDate,
  isDateBefore,
} from "@/lib/date";

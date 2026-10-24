/**
 * Notification types (safe to import in the browser). Every push has a type;
 * automatic types can be switched off on the admin Notifications page
 * (settings/notifications.disabled). CUSTOM is always on.
 */
export const AUTOMATIC_PUSH_TYPES = {
  TASK_ASSIGNED: "Task assigned",
  TASK_COMPLETED: "Task completed (to the pastor who assigned it)",
  TASK_REMINDER: "Task due tomorrow / overdue",
  ROSTER_REMINDER: "Sunday duty reminder (Saturday)",
  DEVOTION_REMINDER: "Devotion reminder (day before and on the day)",
  CHECKUP_PARTNER: "Monday check-up partner",
  REPORT_REMINDER: "Department report reminder (Monday)",
  FOLLOWUP_REMINDER: "Follow-up reminder (Tuesday)",
} as const;

export type AutomaticPushType = keyof typeof AUTOMATIC_PUSH_TYPES;
export type PushType = AutomaticPushType | "CUSTOM";

export const PUSH_TYPE_LABELS: Record<PushType, string> = { ...AUTOMATIC_PUSH_TYPES, CUSTOM: "Custom message" };

/** Per person: "sent" (reached at least one device), "failed", or "no_device" (never enabled notifications). */
export type DeliveryStatus = "sent" | "failed" | "no_device";

import type { AppRole, Department } from "@/types";

/**
 * The single source of truth for who can do what.
 *
 * Every page, server route and component asks `can(user, "permission")`.
 * firestore.rules can't import this file, so `npm run rules:sync` copies the
 * same lists into the generated block at the top of firestore.rules, and
 * `npm run rules:check` (also run by the test suite) fails if they drift apart.
 *
 * A user has a permission if their role is listed, or they belong to one of
 * the listed departments. ADMIN is a super-user and is in every list.
 */
export const PERMISSIONS = {
  /** Create, edit and delete user accounts, roles and departments */
  manageUsers: { roles: ["ADMIN"] },
  /** See every department's report (All Reports, History) and forward any of them */
  viewAllReports: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"] },
  /** Write or edit any department's report, not just their own departments' */
  writeAnyReport: { roles: ["LEAD_PASTOR", "ADMIN"] },
  /** See every task, not just the ones assigned to them */
  viewAllTasks: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"] },
  /** Assign, edit and delete tasks */
  assignTasks: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"] },
  /** Assign Sunday roster duties */
  editRoster: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"] },
  /** Edit the devotion schedule, teachers, topics and notes */
  editDevotion: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"], departments: ["DEVOTION"] },
  /** Attendance list, check-in QR code, congregation member details */
  manageAttendance: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"], departments: ["USHERING"] },
  /** Switch follow-up campus; edit or delete any follow-up contact */
  manageAllFollowUps: { roles: ["PASTOR", "LEAD_PASTOR", "ADMIN"] },
} as const satisfies Record<string, { roles: readonly AppRole[]; departments?: readonly Department[] }>;

export type Permission = keyof typeof PERMISSIONS;

type PermissionUser = { role?: AppRole | string | null; departments?: readonly string[] | null };

export function can(user: PermissionUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const rule: { roles: readonly string[]; departments?: readonly string[] } = PERMISSIONS[permission];
  if (user.role && rule.roles.includes(user.role)) return true;
  return (rule.departments ?? []).some((d) => (user.departments ?? []).includes(d));
}

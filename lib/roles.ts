import type { AppRole } from "@/types";

/** Roles that have pastor-level access (All Reports, Roster editing, Task management) */
const PASTOR_ROLES: AppRole[] = ["PASTOR", "LEAD_PASTOR", "ADMIN"];

/** Roles that can edit the devotion schedule */
const DEVOTION_EDIT_ROLES: AppRole[] = ["DEVOTION_LEAD", "PASTOR", "LEAD_PASTOR", "ADMIN"];

/** Roles that can edit the roster */
const ROSTER_EDIT_ROLES: AppRole[] = ["PASTOR", "LEAD_PASTOR", "ADMIN"];

export function isPastor(role: AppRole | string): boolean {
  return PASTOR_ROLES.includes(role as AppRole);
}

export function isLeadPastor(role: AppRole | string): boolean {
  return role === "LEAD_PASTOR";
}

export function isAdmin(role: AppRole | string): boolean {
  return role === "ADMIN";
}

export function canEditRoster(role: AppRole | string): boolean {
  return ROSTER_EDIT_ROLES.includes(role as AppRole);
}

export function canEditDevotion(role: AppRole | string): boolean {
  return DEVOTION_EDIT_ROLES.includes(role as AppRole);
}

export function canManageUsers(role: AppRole | string): boolean {
  return role === "ADMIN";
}

export function canAssignTasks(role: AppRole | string): boolean {
  return PASTOR_ROLES.includes(role as AppRole);
}

export function canDeleteTasks(role: AppRole | string): boolean {
  return PASTOR_ROLES.includes(role as AppRole);
}

export { PASTOR_ROLES, DEVOTION_EDIT_ROLES, ROSTER_EDIT_ROLES };

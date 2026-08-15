import { Timestamp } from "firebase/firestore";

// ─── Roles ────────────────────────────────────────────────────────────────────
export type AppRole = "WORKER" | "PASTOR" | "LEAD_PASTOR" | "DEVOTION_LEAD";

// ─── Collections ──────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: AppRole;
  department: string;
}

export interface Report {
  id?: string;
  department: string;
  /** Sanitized HTML or Tiptap JSON string */
  content: string;
  last_edited_by: string; // uid
  created_at: Timestamp;
  /** ISO date string of the Sunday this report targets (e.g. "2025-06-29") */
  target_sunday: string;
}

export interface Feedback {
  id?: string;
  user_id: string;
  service_date: Timestamp;
  /** Sanitized HTML or Tiptap JSON string */
  content: string;
}

export type TaskStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export interface Task {
  id?: string;
  assigned_to: string; // uid
  assigned_by: string; // uid
  description: string;
  status: TaskStatus;
  deadline: Timestamp;
}

export interface DevotionSchedule {
  id?: string;
  target_date: Timestamp;
  assigned_to: string; // uid
  /** Sanitized HTML or Tiptap JSON string */
  teaching_notes: string;
}

export interface Roster {
  id?: string;
  service_date: Timestamp;
  duty: string;
  assigned_to: string; // uid
}

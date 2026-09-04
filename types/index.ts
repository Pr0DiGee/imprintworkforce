import { Timestamp } from "firebase/firestore";

// ─── Roles ────────────────────────────────────────────────────────────────────
export type AppRole = "WORKER" | "PASTOR" | "LEAD_PASTOR" | "DEVOTION_LEAD" | "ADMIN";

// ─── Departments ──────────────────────────────────────────────────────────────
export type Department =
  | "CHOIR"
  | "MEDIA"
  | "USHERING"
  | "DEVOTION"
  | "BABCOCK_CAMPUS";

export const DEPARTMENTS: Department[] = [
  "CHOIR",
  "MEDIA",
  "USHERING",
  "DEVOTION",
  "BABCOCK_CAMPUS",
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  CHOIR: "Choir",
  MEDIA: "Media",
  USHERING: "Ushering",
  DEVOTION: "Devotion",
  BABCOCK_CAMPUS: "Babcock Campus",
};

// ─── Roster Duties ──────────────────────────────────────────────────────────────
export type RosterDuty =
  | "WORKERS_MEETING"
  | "CALL_TO_WORSHIP"
  | "PRAYER_CHARGE"
  | "SERMON"
  | "OFFERING_ANNOUNCEMENT"
  | "BENEDICTION";

export const ROSTER_DUTIES: RosterDuty[] = [
  "WORKERS_MEETING",
  "CALL_TO_WORSHIP",
  "PRAYER_CHARGE",
  "SERMON",
  "OFFERING_ANNOUNCEMENT",
  "BENEDICTION",
];

export const ROSTER_DUTY_LABELS: Record<RosterDuty, string> = {
  WORKERS_MEETING: "Workers Meeting",
  CALL_TO_WORSHIP: "Call to Worship",
  PRAYER_CHARGE: "Prayer Charge",
  SERMON: "Sermon",
  OFFERING_ANNOUNCEMENT: "Offering & Announcement",
  BENEDICTION: "Benediction",
};

// ─── Collections ──────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: AppRole;
  /** Array of departments the user belongs to */
  departments: Department[];
  /** @deprecated Use `departments` array instead. Kept for migration compatibility. */
  department?: Department | "";
  /** Profile picture URL */
  photo_url?: string;
}

export type ReportStatus = "DRAFT" | "SUBMITTED";

export interface Report {
  id?: string;
  department: Department;
  /** Stringified Tiptap JSON document */
  content: string;
  status: ReportStatus;
  last_edited_by: string; // uid
  submitted_by?: string; // uid of person who submitted
  created_at: Timestamp;
  last_edited_at?: Timestamp;
  submitted_at?: Timestamp;
  /** ISO date string of the Sunday this report targets e.g. "2025-06-29" */
  target_sunday: string;
}

export interface Feedback {
  id?: string;
  user_id: string;
  /** ISO date string of the target Sunday e.g. "2025-06-29" */
  service_date: string;
  /** Plain text — no rich text needed for feedback */
  content: string;
  submitted_at?: Timestamp;
  updated_at?: Timestamp;
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

export interface DevotionDaily {
  id?: string;
  /** ISO date string of the specific day e.g. "2026-08-17" */
  date: string;
  assigned_to: string; // uid of the person leading devotion
  backup_teacher?: string; // uid of the backup devotion leader
  /** Plain text topic for the day */
  topic: string;
  /** Stringified Tiptap JSON document */
  teaching_notes: string;
  last_edited_by: string; // uid
  created_at?: Timestamp;
  last_edited_at?: Timestamp;
}

export interface Roster {
  id?: string;
  /** ISO date string of the target Sunday e.g. "2025-06-29" */
  service_date: string;
  duty: RosterDuty;
  assigned_to: string; // uid
  assigned_by: string; // uid
  created_at?: Timestamp;
}

// ─── Congregation (Public Check-In) ──────────────────────────────────────────

export interface CongregationMember {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  address?: string;
  created_at?: Timestamp;
  last_checkin?: Timestamp;
  attendance_count?: number;
}

export interface AttendanceRecord {
  id?: string;
  member_id: string;
  service_date: string; // ISO Sunday string
  checked_in_at?: Timestamp;
}

// ─── Worker Notes (Private, iOS-style folders) ───────────────────────────────

export interface NoteFolder {
  id?: string;
  user_id: string;
  name: string;
  /** Optional color tag for the folder */
  color?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface Note {
  id?: string;
  user_id: string;
  folder_id: string;
  title: string;
  /** Stringified Tiptap JSON document */
  content: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

// ─── Follow-Up ───────────────────────────────────────────────────────────────

export type FollowUpMethod = "PHYSICAL" | "CALL" | "TEXT";

export interface FollowUpContact {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  assigned_to: string; // uid of the worker
  created_at?: Timestamp;
}

export interface FollowUpLog {
  id?: string;
  contact_id: string;
  worker_id: string; // UID of the worker who logged it
  method: FollowUpMethod;
  notes?: string;
  /** ISO date string of the current target Sunday to track weekly completion e.g. "2026-08-23" */
  target_sunday: string;
  logged_at?: Timestamp;
}

// ─── Evangelism ────────────────────────────────────────────────────────────────

export interface EvangelismContact {
  id?: string;
  name: string;
  phone: string;
  reached_out_by: string; // worker uid who reached out
  added_by: string; // worker uid who added the record
  created_at?: Timestamp;
}

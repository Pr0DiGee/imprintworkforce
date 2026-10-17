/**
 * Server-side data fetching helpers using firebase-admin.
 * These are called from Server Components to pre-fetch data,
 * avoiding client-side Firestore reads entirely.
 */
import { getAdminDb } from "@/lib/firebase/admin";
import type {
  UserProfile,
  Report,
  Task,
  Feedback,
  Roster,
  DevotionDaily,
  Department,
  RosterDuty,
  ROSTER_DUTIES,
  NoteFolder,
  Note,
  FollowUpContact,
  FollowUpLog,
} from "@/types";
import { can } from "@/lib/permissions";
import { DEPARTMENTS } from "@/types";
import { toJsDate } from "@/lib/date";

import { serializeData } from "@/lib/serialize";

const db = () => getAdminDb();

// Timestamps → ISO strings before data reaches Client Components
export { serializeData };

// ─── Users ─────────────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await db().collection("users").orderBy("name").get();
  return snap.docs.map((d) => ({ uid: d.id, ...serializeData(d.data()) } as UserProfile));
}

export async function fetchUserMap(): Promise<Record<string, string>> {
  const snap = await db().collection("users").get();
  const map: Record<string, string> = {};
  snap.docs.forEach((d) => {
    map[d.id] = (d.data() as UserProfile).name;
  });
  return map;
}

// ─── Reports ───────────────────────────────────────────────────────────────────

export async function fetchReportsForSunday(
  targetSunday: string
): Promise<Report[]> {
  const snap = await db()
    .collection("reports")
    .where("target_sunday", "==", targetSunday)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as Report));
}

export async function fetchAllReportSundays(): Promise<
  { targetSunday: string; count: number }[]
> {
  const snap = await db().collection("reports").get();
  const map = new Map<string, number>();
  snap.docs.forEach((d) => {
    const ts = d.data().target_sunday;
    if (ts) map.set(ts, (map.get(ts) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([targetSunday, count]) => ({ targetSunday, count }))
    .sort((a, b) => b.targetSunday.localeCompare(a.targetSunday));
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(user: UserProfile): Promise<Task[]> {
  const col = db().collection("tasks");
  let snap;

  if (can(user, "viewAllTasks")) {
    snap = await col.get();
  } else {
    snap = await col.where("assigned_to", "==", user.uid).get();
  }

  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as Task));
}

// ─── Feedback ──────────────────────────────────────────────────────────────────

export async function fetchFeedbackForSunday(
  serviceDateStr: string
): Promise<Feedback[]> {
  const snap = await db()
    .collection("feedback")
    .where("service_date", "==", serviceDateStr)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as Feedback));
}

// ─── Roster ────────────────────────────────────────────────────────────────────

export async function fetchRosterForSunday(
  serviceDate: string
): Promise<Record<string, Roster>> {
  const snap = await db()
    .collection("roster")
    .where("service_date", "==", serviceDate)
    .get();
  const map: Record<string, Roster> = {};
  snap.docs.forEach((d) => {
    const data = serializeData(d.data()) as Roster;
    map[data.duty] = { id: d.id, ...data };
  });
  return map;
}

// ─── Devotion ──────────────────────────────────────────────────────────────────

export async function fetchDevotionForDates(
  dates: string[]
): Promise<Record<string, DevotionDaily>> {
  if (dates.length === 0) return {};

  // Firestore `in` queries support max 30 values; we only ever pass 6 (Mon-Sat)
  const snap = await db()
    .collection("devotion")
    .where("date", "in", dates)
    .get();

  const map: Record<string, DevotionDaily> = {};
  snap.docs.forEach((d) => {
    const data = serializeData(d.data()) as DevotionDaily;
    map[data.date] = { id: d.id, ...data };
  });
  return map;
}

// ─── Dashboard Stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  reportsSubmitted: number;
  reportTotal: number;
  globalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  feedbackCount: number;
}

export async function fetchDashboardStats(
  user: UserProfile,
  currentSunday: string
): Promise<DashboardStats> {
  const [reports, tasks, feedback] = await Promise.all([
    fetchReportsForSunday(currentSunday),
    fetchTasks(user),
    fetchFeedbackForSunday(currentSunday),
  ]);
  let reportsSubmitted: number;
  let reportTotal: number;

  if (can(user, "viewAllReports")) {
    reportsSubmitted = reports.filter((r) => r.status === "SUBMITTED").length;
    reportTotal = DEPARTMENTS.length;
  } else {
    const userDepts = user.departments || [];
    const myReport = reports.find((r) => userDepts.includes(r.department));
    reportsSubmitted = myReport ? 1 : 0;
    reportTotal = 1;
  }

  // "Mine" = tasks I assigned (if I can assign) or tasks assigned to me
  const now = new Date();
  const active = tasks.filter((t) => t.status !== "COMPLETED");
  const mine = can(user, "assignTasks")
    ? active.filter((t) => t.assigned_by === user.uid)
    : active.filter((t) => t.assigned_to === user.uid);
  const globalTasks = active.length;
  const activeTasks = mine.length;
  const overdueTasks = mine.filter((t) => {
    const dl = toJsDate(t.deadline);
    return dl !== null && dl < now;
  }).length;

  return {
    reportsSubmitted,
    reportTotal,
    globalTasks,
    activeTasks,
    overdueTasks,
    feedbackCount: feedback.length,
  };
}

// ─── Worker Notes ──────────────────────────────────────────────────────────────

export async function fetchNoteFolders(userId: string): Promise<NoteFolder[]> {
  const snap = await db()
    .collection("note_folders")
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as NoteFolder));
}

export async function fetchNotesForFolder(
  userId: string,
  folderId: string
): Promise<Note[]> {
  const snap = await db()
    .collection("notes")
    .where("user_id", "==", userId)
    .where("folder_id", "==", folderId)
    .orderBy("updated_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as Note));
}

export async function fetchAllNotesForUser(userId: string): Promise<Note[]> {
  const snap = await db()
    .collection("notes")
    .where("user_id", "==", userId)
    .orderBy("updated_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as Note));
}

// ─── Follow-Up ─────────────────────────────────────────────────────────────────

export async function fetchFollowUpContacts(): Promise<FollowUpContact[]> {
  const snap = await db()
    .collection("followup_contacts")
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as FollowUpContact));
}

export async function fetchFollowUpLogs(): Promise<FollowUpLog[]> {
  const snap = await db()
    .collection("followup_logs")
    .orderBy("logged_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as FollowUpLog));
}


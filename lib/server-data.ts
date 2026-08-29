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
  EvangelismContact,
} from "@/types";
import { isPastor, isLeadPastor } from "@/lib/roles";

const db = () => getAdminDb();

// Helper to serialize Firestore Timestamps for Client Components
export function serializeData(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  if (data.toDate && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (data._seconds !== undefined && data._nanoseconds !== undefined) {
    return new Date(data._seconds * 1000).toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(serializeData);
  }
  const result: any = {};
  for (const key of Object.keys(data)) {
    result[key] = serializeData(data[key]);
  }
  return result;
}

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

  if (isLeadPastor(user.role)) {
    // Lead pastor sees ALL non-completed tasks
    snap = await col.get();
  } else if (isPastor(user.role)) {
    // Pastor sees tasks they assigned
    snap = await col.where("assigned_by", "==", user.uid).get();
  } else {
    // Worker sees tasks assigned to them
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
  // Reports — targeted query for this Sunday only
  const reports = await fetchReportsForSunday(currentSunday);
  let reportsSubmitted: number;
  let reportTotal: number;

  if (isPastor(user.role)) {
    reportsSubmitted = reports.filter((r) => r.status === "SUBMITTED").length;
    reportTotal = 5; // DEPARTMENTS.length
  } else {
    const userDepts = user.departments || [];
    const myReport = reports.find((r) => userDepts.includes(r.department));
    reportsSubmitted = myReport ? 1 : 0;
    reportTotal = 1;
  }

  // Tasks — targeted queries based on role
  const tasks = await fetchTasks(user);
  const now = new Date();
  let globalTasks = 0;
  let activeTasks = 0;
  let overdueTasks = 0;

  tasks.forEach((t) => {
    if (t.status !== "COMPLETED") {
      if (isLeadPastor(user.role)) {
        globalTasks++;
        if (t.assigned_by === user.uid) {
          activeTasks++;
          const dl = t.deadline ? new Date(t.deadline as unknown as string) : null;
          if (dl && dl < now) overdueTasks++;
        }
      } else if (isPastor(user.role)) {
        activeTasks++;
        const dl = t.deadline ? new Date(t.deadline as unknown as string) : null;
        if (dl && dl < now) overdueTasks++;
      } else {
        activeTasks++;
        const dl = t.deadline ? new Date(t.deadline as unknown as string) : null;
        if (dl && dl < now) overdueTasks++;
      }
    }
  });

  // Feedback — targeted query for this Sunday
  const feedback = await fetchFeedbackForSunday(currentSunday);

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

// ─── Evangelism ────────────────────────────────────────────────────────────────

export async function fetchEvangelismContacts(): Promise<EvangelismContact[]> {
  const snap = await db()
    .collection("evangelism_contacts")
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as EvangelismContact));
}


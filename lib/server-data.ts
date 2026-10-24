/**
 * Server-side data fetching helpers using firebase-admin.
 * These are called from Server Components to pre-fetch data,
 * avoiding client-side Firestore reads entirely.
 */
import { cache } from "react";
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
  CongregationMember,
  AttendanceRecord,
  FollowUpLog,
} from "@/types";
import { can } from "@/lib/permissions";
import { DEPARTMENTS } from "@/types";
import { toJsDate, getTargetSundayString, addWeeksToDate } from "@/lib/date";

import { serializeData } from "@/lib/serialize";

const db = () => getAdminDb();

// Timestamps → ISO strings before data reaches Client Components
export { serializeData };

// ─── Users ─────────────────────────────────────────────────────────────────────

// cache(): within one request, every caller shares a single Firestore read
export const fetchAllUsers = cache(async (): Promise<UserProfile[]> => {
  const snap = await db().collection("users").orderBy("name").get();
  return snap.docs.map((d) => ({ uid: d.id, ...serializeData(d.data()) } as UserProfile));
});

export const fetchUserMap = cache(async (): Promise<Record<string, string>> => {
  const users = await fetchAllUsers();
  return Object.fromEntries(users.map((u) => [u.uid, u.name]));
});

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

/**
 * Report counts for the most recent `weeks` Sundays (newest first), counted by
 * Firestore so no report content is downloaded. Weeks with no reports are omitted.
 */
export async function fetchReportCountsByWeek(weeks: number): Promise<
  { targetSunday: string; count: number }[]
> {
  const latest = getTargetSundayString();
  const sundays = Array.from({ length: weeks }, (_, i) => addWeeksToDate(latest, -i));
  const counts = await Promise.all(
    sundays.map(async (targetSunday) => {
      const agg = await db().collection("reports").where("target_sunday", "==", targetSunday).count().get();
      return { targetSunday, count: agg.data().count };
    })
  );
  return counts.filter((w) => w.count > 0);
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

/** Number of notes per folder, counted by Firestore (no note content is downloaded). */
export async function fetchNoteCounts(userId: string, folderIds: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    folderIds.map(async (folderId) => {
      const agg = await db()
        .collection("notes")
        .where("user_id", "==", userId)
        .where("folder_id", "==", folderId)
        .count()
        .get();
      return [folderId, agg.data().count] as const;
    })
  );
  return Object.fromEntries(entries);
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



// ─── Congregation / Attendance ─────────────────────────────────────────────────

function toMember(doc: FirebaseFirestore.DocumentSnapshot): CongregationMember {
  return { id: doc.id, ...serializeData(doc.data()) } as CongregationMember;
}

export type Attendee = CongregationMember & {
  /** Which visit this Sunday was for them: 1 = first time, 2 = second, … */
  visit_number: number;
};

/** Everyone who checked in on one Sunday, with which visit it was for them. */
export async function fetchAttendeesForSunday(sunday: string): Promise<Attendee[]> {
  const snap = await db().collection("attendance").where("service_date", "==", sunday).get();
  const visitByMember = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    visitByMember.set(data.member_id, typeof data.visit_number === "number" ? data.visit_number : 0);
  });

  const ids = Array.from(visitByMember.keys());
  const attendees: Attendee[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db().collection("congregation").doc(id));
    const docs = await db().getAll(...refs);
    docs.filter((doc) => doc.exists).forEach((doc) => {
      const member = toMember(doc);
      // Records from before visit numbers were stored fall back to the current total
      const visit = visitByMember.get(doc.id) || member.attendance_count || 1;
      attendees.push({ ...member, visit_number: visit });
    });
  }
  return attendees.sort((x, y) => x.name.localeCompare(y.name));
}

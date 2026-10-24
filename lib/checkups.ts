/**
 * Weekly check-up partners (server-only).
 *
 * Every Monday (daily cron) everyone except admins is randomly paired; with an
 * odd number, one group of three checks up in a ring (A→B→C→A). Each person
 * gets one `checkup_tasks/{monday}_{checkerUid}` task to tick off. Pairings
 * from the last 4 weeks are avoided where possible. The whole week is written
 * in one batch that starts with `create()` on `checkup_weeks/{monday}`, so a
 * second run for the same week does nothing, and pushes are claimed once each.
 */
import { addDays, format, parseISO } from "date-fns";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { getCurrentWeekMonday, getTargetSundayString } from "@/lib/date";
import { claimPushKey, sendPushNotification } from "@/lib/push-notifications";
import { DEPARTMENT_LABELS, type Department, type UserProfile } from "@/types";

export const CHECKUP_WEEKS_KEPT = 4;

export interface CheckupTask {
  id: string;
  week: string; // Monday "YYYY-MM-DD"
  checker: string;
  target: string;
  completed: boolean;
  completed_at?: string | null;
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const weeksAgo = (monday: string, n: number) => format(addDays(parseISO(monday), -7 * n), "yyyy-MM-dd");

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Arrange people into pairs (and one trio if odd), avoiding recent partners. */
export function drawCheckups(uids: string[], recentEdges: Set<string>, attempts = 500) {
  if (uids.length < 2) return [];
  let best: { checker: string; target: string }[] = [];
  let bestRepeats = Infinity;

  for (let attempt = 0; attempt < attempts && bestRepeats > 0; attempt++) {
    const order = shuffle(uids);
    const assignments: { checker: string; target: string }[] = [];
    let repeats = 0;
    let i = 0;
    if (order.length % 2 === 1) {
      const [a, b, c] = order;
      assignments.push({ checker: a, target: b }, { checker: b, target: c }, { checker: c, target: a });
      repeats += [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)].filter((e) => recentEdges.has(e)).length;
      i = 3;
    }
    for (; i < order.length; i += 2) {
      const [a, b] = [order[i], order[i + 1]];
      assignments.push({ checker: a, target: b }, { checker: b, target: a });
      if (recentEdges.has(edgeKey(a, b))) repeats++;
    }
    if (repeats < bestRepeats) {
      best = assignments;
      bestRepeats = repeats;
    }
  }
  return best;
}

/** Monday job: create this week's check-ups (once) and notify everyone. */
export async function createWeeklyCheckups(now: Date = new Date()) {
  const db = getAdminDb();
  const monday = getCurrentWeekMonday(now);
  const weekRef = db.collection("checkup_weeks").doc(monday);
  if ((await weekRef.get()).exists) {
    console.log(`[CRON] Check-ups for ${monday} already exist; skipping.`);
    return;
  }

  const users = (await db.collection("users").get()).docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile);
  const participants = users.filter((u) => !can(u, "manageUsers"));
  const names = Object.fromEntries(users.map((u) => [u.uid, u.name]));

  const history = await db.collection("checkup_tasks").where("week", ">=", weeksAgo(monday, CHECKUP_WEEKS_KEPT)).where("week", "<", monday).get();
  const recent = new Set(history.docs.map((d) => edgeKey(d.data().checker, d.data().target)));

  const assignments = drawCheckups(participants.map((u) => u.uid), recent);

  const batch = db.batch();
  batch.create(weekRef, { week: monday, created_at: new Date(), people: assignments.length });
  for (const a of assignments) {
    batch.set(db.collection("checkup_tasks").doc(`${monday}_${a.checker}`), {
      week: monday,
      checker: a.checker,
      target: a.target,
      completed: false,
      created_at: new Date(),
    });
  }
  try {
    await batch.commit();
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 6) return; // another run made this week's pairs first
    throw err;
  }

  for (const a of assignments) {
    if (!(await claimPushKey(`CHECKUP_${monday}_${a.checker}`, { recipient: a.checker }))) continue;
    await sendPushNotification({
      type: "CHECKUP_PARTNER",
      uids: [a.checker],
      title: "Your check-up partner this week",
      body: `Check up on ${names[a.target] ?? "your partner"} this week.`,
      url: "/dashboard/tasks",
    });
  }
  console.log(`[CRON] Check-ups for ${monday}: ${assignments.length} people.`);

  // Keep only the weeks still shown or used to avoid repeats
  const old = await db.collection("checkup_tasks").where("week", "<", weeksAgo(monday, CHECKUP_WEEKS_KEPT)).get();
  const oldWeeks = await db.collection("checkup_weeks").where("week", "<", weeksAgo(monday, CHECKUP_WEEKS_KEPT)).get();
  const docs = [...old.docs, ...oldWeeks.docs];
  for (let i = 0; i < docs.length; i += 400) {
    const b = db.batch();
    docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

/** Monday job: remind every member of a department whose report isn't submitted. */
export async function sendReportReminders(now: Date = new Date()) {
  const db = getAdminDb();
  const sunday = getTargetSundayString(now);
  const users = (await db.collection("users").get()).docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile);

  const depts = Array.from(new Set(users.flatMap((u) => u.departments ?? []))) as Department[];
  for (const dept of depts) {
    const report = await db.collection("reports").doc(`${dept}_${sunday}`).get();
    if (report.data()?.status === "SUBMITTED") continue;
    for (const u of users.filter((x) => (x.departments ?? []).includes(dept))) {
      if (!(await claimPushKey(`REPORT_REMINDER_${sunday}_${dept}_${u.uid}`, { recipient: u.uid }))) continue;
      await sendPushNotification({
        type: "REPORT_REMINDER",
        uids: [u.uid],
        title: "Department report due tonight",
        body: `The ${DEPARTMENT_LABELS[dept]} report for Sunday hasn't been submitted yet. It's due by 8pm today.`,
        url: "/dashboard/reports",
      });
    }
  }
}

/**
 * Admin-written push messages (server-only). Stored in `custom_pushes`;
 * sent immediately, or on a chosen date during that day's cron run (9–10am
 * Lagos on Vercel's free plan). A status transaction makes each one send once.
 */
import { getAdminDb } from "@/lib/firebase/admin";
import { getLagosToday } from "@/lib/date";
import { sendPushNotification } from "@/lib/push-notifications";
import { DEPARTMENTS, type Department, type UserProfile } from "@/types";

export type Audience =
  | { kind: "everyone" }
  | { kind: "pastors" }
  | { kind: "department"; department: Department }
  | { kind: "people"; uids: string[] };

export interface CustomPushInput {
  title: string;
  body: string;
  url?: string;
  audience: Audience;
  /** "now", or a date "YYYY-MM-DD" (sent in that day's morning run) */
  sendOn: string;
}

export function validateAudience(a: Audience): string | null {
  if (a.kind === "department" && !DEPARTMENTS.includes(a.department)) return "Choose a department.";
  if (a.kind === "people" && (!Array.isArray(a.uids) || a.uids.length === 0)) return "Choose at least one person.";
  if (!["everyone", "pastors", "department", "people"].includes(a.kind)) return "Choose who to send to.";
  return null;
}

export async function resolveAudience(a: Audience): Promise<string[]> {
  const users = (await getAdminDb().collection("users").get()).docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile);
  switch (a.kind) {
    case "everyone":
      return users.map((u) => u.uid);
    case "pastors":
      return users.filter((u) => u.role === "PASTOR" || u.role === "LEAD_PASTOR").map((u) => u.uid);
    case "department":
      return users.filter((u) => (u.departments ?? []).includes(a.department)).map((u) => u.uid);
    case "people": {
      const existing = new Set(users.map((u) => u.uid));
      return a.uids.filter((uid) => existing.has(uid));
    }
  }
}

/** Send one custom push if it's still waiting; returns false if it was already sent or cancelled. */
export async function sendCustomPush(id: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection("custom_pushes").doc(id);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.status !== "scheduled") return null;
    tx.update(ref, { status: "sending" });
    return snap.data()!;
  });
  if (!claimed) return false;

  try {
    const uids = await resolveAudience(claimed.audience as Audience);
    const result = await sendPushNotification({
      type: "CUSTOM",
      uids,
      title: claimed.title,
      body: claimed.body,
      url: claimed.url || "/dashboard",
      customId: id,
      triggeredBy: claimed.created_by,
    });
    await ref.update({ status: "sent", sent_at: new Date(), log_id: result.logId ?? null, recipient_count: uids.length });
    return true;
  } catch (err) {
    await ref.update({ status: "scheduled" }); // let a later run retry
    throw err;
  }
}

/** Daily cron: send custom pushes scheduled for today (or missed earlier days). */
export async function sendScheduledCustomPushes(now: Date = new Date()) {
  try {
    const today = getLagosToday(now).date;
    const due = await getAdminDb().collection("custom_pushes").where("status", "==", "scheduled").get();
    for (const doc of due.docs.filter((d) => String(d.data().send_on) <= today)) {
      await sendCustomPush(doc.id);
    }
  } catch (error) {
    console.error("Cron Error (custom pushes):", error);
  }
}

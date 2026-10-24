"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { getLagosToday } from "@/lib/date";
import { AUTOMATIC_PUSH_TYPES, sendPushNotification, type AutomaticPushType, type PushType } from "@/lib/push-notifications";
import { sendCustomPush, validateAudience, type Audience } from "@/lib/custom-pushes";

type Result = { success: true; message?: string } | { error: string };

async function requireAdmin() {
  const user = await getServerUser();
  return user && can(user, "manageNotifications") ? user : null;
}

/** Switch an automatic notification type on or off. */
export async function setPushTypeEnabled(type: AutomaticPushType, enabled: boolean): Promise<Result> {
  if (!(await requireAdmin())) return { error: "Unauthorized" };
  if (!(type in AUTOMATIC_PUSH_TYPES)) return { error: "Unknown notification type" };
  await getAdminDb().collection("settings").doc("notifications").set({ disabled: { [type]: !enabled } }, { merge: true });
  revalidatePath("/dashboard/notifications");
  return { success: true };
}

/** Write a custom push: send now, or schedule it for a date (sent in that morning's run). */
export async function createCustomPush(input: {
  title: string;
  body: string;
  audience: Audience;
  sendOn: string; // "now" | "YYYY-MM-DD"
}): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };

  const title = String(input.title ?? "").trim().slice(0, 80);
  const body = String(input.body ?? "").trim().slice(0, 300);
  if (!title || !body) return { error: "Please write a title and a message." };
  const audienceError = validateAudience(input.audience);
  if (audienceError) return { error: audienceError };

  const today = getLagosToday().date;
  const sendNow = input.sendOn === "now" || input.sendOn === today;
  if (!sendNow && (!/^\d{4}-\d{2}-\d{2}$/.test(input.sendOn) || input.sendOn < today)) {
    return { error: "Choose today or a future date." };
  }

  const ref = await getAdminDb().collection("custom_pushes").add({
    title,
    body,
    url: "/dashboard",
    audience: input.audience,
    send_on: sendNow ? today : input.sendOn,
    status: "scheduled",
    created_by: admin.uid,
    created_at: new Date(),
  });

  if (sendNow) await sendCustomPush(ref.id);
  revalidatePath("/dashboard/notifications");
  return { success: true, message: sendNow ? "Message sent" : `Scheduled for the morning of ${input.sendOn}` };
}

/** Cancel a scheduled custom push before it goes out. */
export async function cancelCustomPush(id: string): Promise<Result> {
  if (!(await requireAdmin())) return { error: "Unauthorized" };
  if (!id || id.includes("/")) return { error: "Invalid message" };
  const db = getAdminDb();
  const ref = db.collection("custom_pushes").doc(id);
  const cancelled = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.status !== "scheduled") return false;
    tx.update(ref, { status: "cancelled", cancelled_at: new Date() });
    return true;
  });
  revalidatePath("/dashboard/notifications");
  return cancelled ? { success: true } : { error: "That message has already been sent or cancelled." };
}

/** Re-send a logged notification to the people it failed to reach. */
export async function resendFailed(logId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };
  if (!logId || logId.includes("/")) return { error: "Invalid notification" };

  const ref = getAdminDb().collection("push_log").doc(logId);
  const log = (await ref.get()).data();
  if (!log) return { error: "Notification not found." };
  const failed = Object.entries((log.delivery ?? {}) as Record<string, string>)
    .filter(([, status]) => status === "failed")
    .map(([uid]) => uid);
  if (failed.length === 0) return { error: "Nobody to re-send to: it didn't fail for anyone." };

  const result = await sendPushNotification({
    type: log.type as PushType,
    uids: failed,
    title: log.title,
    body: log.body,
    url: log.url,
    force: true,
    resendOf: logId,
    triggeredBy: admin.uid,
  });
  await ref.update({ resent_at: new Date() });
  revalidatePath("/dashboard/notifications");
  const reached = Object.values(result.delivery).filter((s) => s === "sent").length;
  return { success: true, message: `Re-sent: reached ${reached} of ${failed.length}` };
}

"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { lagosTime } from "@/lib/date";

type Result = { success: true } | { error: string };

function parseDeadline(value: unknown): Date | null {
  const date = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? lagosTime(date, 23, 59) : null;
}

/** Create or edit one of your own personal tasks (description + deadline). */
export async function savePersonalTask(taskId: string | null, description: string, deadline: string): Promise<Result> {
  const user = await getServerUser();
  if (!user) return { error: "Unauthorized" };
  const text = String(description ?? "").trim().slice(0, 500);
  const due = parseDeadline(deadline);
  if (!text) return { error: "Please describe the task." };
  if (!due) return { error: "Please choose a deadline." };

  const col = getAdminDb().collection("tasks");
  try {
    if (taskId) {
      if (taskId.includes("/")) return { error: "Invalid task" };
      const snap = await col.doc(taskId).get();
      const data = snap.data();
      if (!snap.exists || !data?.personal || data.assigned_to !== user.uid) return { error: "You can only edit your own personal tasks." };
      await snap.ref.update({ description: text, deadline: Timestamp.fromDate(due) });
    } else {
      await col.add({
        assigned_to: user.uid,
        assigned_by: user.uid,
        personal: true,
        description: text,
        status: "ASSIGNED",
        deadline: Timestamp.fromDate(due),
        created_at: Timestamp.now(),
      });
    }
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("[savePersonalTask]", err);
    return { error: "Couldn't save the task." };
  }
}

export async function deletePersonalTask(taskId: string): Promise<Result> {
  const user = await getServerUser();
  if (!user || !taskId || taskId.includes("/")) return { error: "Unauthorized" };
  const ref = getAdminDb().collection("tasks").doc(taskId);
  const data = (await ref.get()).data();
  if (!data?.personal || data.assigned_to !== user.uid) return { error: "You can only delete your own personal tasks." };
  await ref.delete();
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

/** Tick (or un-tick) your own weekly check-up. */
export async function setCheckupDone(checkupId: string, done: boolean): Promise<Result> {
  const user = await getServerUser();
  if (!user || !checkupId || checkupId.includes("/")) return { error: "Unauthorized" };
  const ref = getAdminDb().collection("checkup_tasks").doc(checkupId);
  const data = (await ref.get()).data();
  if (!data || data.checker !== user.uid) return { error: "That isn't your check-up." };
  await ref.update({ completed: Boolean(done), completed_at: done ? new Date() : null });
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

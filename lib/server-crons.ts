import { getAdminDb } from "@/lib/firebase/admin";
import { formatTargetSunday, getLagosToday, getTargetSundayString } from "@/lib/date";
import { DevotionDaily, Task, ROSTER_DUTY_LABELS, Roster } from "@/types";
import { Timestamp } from "firebase-admin/firestore";
import { sendPushNotification, claimPushKey } from "@/lib/push-notifications";
import { addDays, format, parseISO } from "date-fns";

function getISODateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

export async function sendTaskReminders() {
  console.log("[CRON] Running Task Reminders via Web Push");
  try {
    const db = getAdminDb();
    
    // Query active tasks
    const tasksSnap = await db
      .collection("tasks")
      .where("status", "in", ["ASSIGNED", "IN_PROGRESS"])
      .get();
      
    if (tasksSnap.empty) {
      console.log("No active tasks found.");
      return;
    }

    const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
    
    const tasksToRemind = tasks.filter(task => {
      if (!task.deadline) return false;
      const deadlineDate = (task.deadline as unknown as Timestamp).toDate();
      const deadlineStr = deadlineDate.toISOString().split("T")[0];
      const deadlineMs = new Date(deadlineStr + "T00:00:00Z").getTime();
      
      const oneDayBeforeDeadlineMs = deadlineMs - 24 * 60 * 60 * 1000;
      const oneDayAfterDeadlineMs = deadlineMs + 24 * 60 * 60 * 1000;
      
      return todayMs === oneDayBeforeDeadlineMs || todayMs === oneDayAfterDeadlineMs;
    });

    if (tasksToRemind.length === 0) {
      console.log("No tasks needing reminders today.");
      return;
    }

    const userTasks: Record<string, Task[]> = {};
    tasksToRemind.forEach(task => {
      if (!userTasks[task.assigned_to]) {
        userTasks[task.assigned_to] = [];
      }
      userTasks[task.assigned_to].push(task);
    });

    for (const [userId, tList] of Object.entries(userTasks)) {
      const summary = tList.length === 1 
        ? `Task: "${tList[0].description}" is due soon or overdue.`
        : `You have ${tList.length} task(s) due soon or overdue.`;

      await sendPushNotification({
        type: "TASK_REMINDER",
        uids: [userId],
        title: "Task Reminder",
        body: summary,
        url: "/dashboard/tasks",
      });
    }
    console.log(`[CRON] Task reminders pushed to ${Object.keys(userTasks).length} user(s).`);
  } catch (error) {
    console.error("Cron Error (Tasks):", error);
  }
}

/**
 * Devotion (Mon–Sat): remind the teacher the day before ("tomorrow") and on
 * the day ("today"). Runs every day; each reminder is claimed once.
 */
export async function sendDevotionReminders(now: Date = new Date()) {
  console.log("[CRON] Running Devotion Reminders via Web Push");
  try {
    const db = getAdminDb();
    const today = getLagosToday(now).date;
    const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");

    const snap = await db.collection("devotion").where("date", "in", [today, tomorrow]).get();
    for (const doc of snap.docs) {
      const devotion = doc.data() as DevotionDaily;
      if (!devotion.assigned_to) continue;
      const when = devotion.date === today ? "today" : "tomorrow";
      if (!(await claimPushKey(`DEVOTION_${when.toUpperCase()}_${devotion.date}_${devotion.assigned_to}`, { recipient: devotion.assigned_to }))) continue;

      const topic = devotion.topic ? ` Topic: ${devotion.topic}` : " The topic isn't set yet.";
      await sendPushNotification({
        type: "DEVOTION_REMINDER",
        uids: [devotion.assigned_to],
        title: when === "today" ? "You're taking devotion today" : "Devotion tomorrow",
        body: when === "today" ? `You're leading devotion today at 8pm.${topic}` : `You're leading devotion tomorrow (${devotion.date}).${topic}`,
        url: "/dashboard/devotion",
      });
    }
  } catch (error) {
    console.error("Cron Error (Devotion):", error);
  }
}

/** Tuesday: "You have N contacts to follow up", to people with contacts not logged this week. */
export async function sendFollowUpReminders(now: Date = new Date()) {
  console.log("[CRON] Running Follow-Up Reminders via Web Push");
  try {
    const db = getAdminDb();
    const sunday = getTargetSundayString(now);
    const [contacts, users] = await Promise.all([db.collection("followup_contacts").get(), db.collection("users").get()]);
    const existing = new Set(users.docs.map((d) => d.id));

    const pending = new Map<string, number>();
    for (const c of contacts.docs) {
      const data = c.data();
      if (!existing.has(data.assigned_to) || data.last_log_sunday === sunday) continue;
      pending.set(data.assigned_to, (pending.get(data.assigned_to) ?? 0) + 1);
    }

    for (const [uid, count] of pending) {
      if (!(await claimPushKey(`FOLLOWUP_${sunday}_${uid}`, { recipient: uid }))) continue;
      await sendPushNotification({
        type: "FOLLOWUP_REMINDER",
        uids: [uid],
        title: "Follow-ups this week",
        body: `You have ${count} ${count === 1 ? "contact" : "contacts"} to follow up this week. Due Wednesday 8pm.`,
        url: "/dashboard/followup",
      });
    }
  } catch (error) {
    console.error("Cron Error (Follow-up):", error);
  }
}

export async function sendRosterReminders() {
  console.log("[CRON] Running Roster Reminders via Web Push");
  try {
    const db = getAdminDb();
    // This function only runs on Saturday (guarded in route.ts),
    // so tomorrow (+1 day) is always the upcoming Sunday.
    const targetSunday = getISODateOffset(1);
    console.log(`[CRON] Roster target Sunday: ${targetSunday}`);
    
    const rosterSnap = await db
      .collection("roster")
      .where("service_date", "==", targetSunday)
      .get();
      
    if (rosterSnap.empty) {
      console.log("No roster duties assigned for upcoming Sunday.");
      return;
    }

    const assignments = rosterSnap.docs.map(doc => doc.data() as Roster);

    for (const assignment of assignments) {
      if (!assignment.assigned_to) continue;

      const dutyLabel = ROSTER_DUTY_LABELS[assignment.duty] || assignment.duty;
      const dateLabel = formatTargetSunday(targetSunday);

      await sendPushNotification({
        type: "ROSTER_REMINDER",
        uids: [assignment.assigned_to],
        title: "Sunday Duty Reminder",
        body: `Reminder: You are scheduled for ${dutyLabel} for service tomorrow (${dateLabel}).`,
        url: "/dashboard/roster",
      });
    }
    console.log(`[CRON] Sunday roster reminders pushed for ${assignments.length} duty assignment(s).`);
  } catch (error) {
    console.error("Cron Error (Roster):", error);
  }
}

/**
 * Delete check-in rate-limit records whose window has passed (expires_at is
 * 24h after creation). Stands in for a Firestore TTL policy, which needs
 * billing enabled and can't be set up until the collection exists.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const db = getAdminDb();
  let total = 0;
  try {
    // Delete in pages so a large backlog can't exceed batch limits
    for (;;) {
      const snap = await db
        .collection("checkin_rate_limits")
        .where("expires_at", "<", new Date())
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      if (snap.size < 400) break;
    }
    console.log(`[CRON] Removed ${total} expired check-in rate-limit record(s).`);
  } catch (error) {
    console.error("Cron Error (rate-limit cleanup):", error);
  }
  return total;
}

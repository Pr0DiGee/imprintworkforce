import { getAdminDb } from "@/lib/firebase/admin";
import { formatTargetSunday } from "@/lib/date";
import { DevotionDaily, Task, ROSTER_DUTY_LABELS, Roster } from "@/types";
import { Timestamp } from "firebase-admin/firestore";
import { sendPushNotification } from "@/lib/push-notifications";

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

export async function sendDevotionReminders() {
  console.log("[CRON] Running Devotion Reminders via Web Push");
  try {
    const db = getAdminDb();
    
    // Remind for tomorrow only
    const tomorrow = getISODateOffset(1);
    const dates = [tomorrow];

    const devotionSnap = await db
      .collection("devotion")
      .where("date", "in", dates)
      .get();
      
    if (devotionSnap.empty) {
      console.log("No devotions found for tomorrow.");
      return;
    }

    const devotions = devotionSnap.docs.map(doc => doc.data() as DevotionDaily);

    for (const devotion of devotions) {
      // Alert only the assigned teacher (skipping backup teacher as requested)
      if (!devotion.assigned_to) continue;

      const topicStr = devotion.topic ? `Topic: ${devotion.topic}` : "Topic not set yet";

      await sendPushNotification({
        uids: [devotion.assigned_to],
        title: "Devotion Tomorrow",
        body: `You are leading devotion tomorrow (${devotion.date}). ${topicStr}`,
        url: "/dashboard/devotion",
      });
    }
    console.log(`[CRON] Devotion reminders pushed for ${devotions.length} schedule(s).`);
  } catch (error) {
    console.error("Cron Error (Devotion):", error);
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

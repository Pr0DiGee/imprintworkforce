import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import { getTargetSundayString, formatTargetSunday } from "@/lib/date";
import { DevotionDaily, Task, ROSTER_DUTY_LABELS, Roster } from "@/types";
import { Timestamp } from "firebase-admin/firestore";

function getISODateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

export async function sendTaskReminders() {
  console.log("[CRON] Running Task Reminders");
  try {
    const db = getAdminDb();
    
    // We want tasks that are NOT completed.
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

    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { email: string; name: string }> = {};
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        userMap[doc.id] = { email: data.email, name: data.name };
      }
    });

    const resend = new Resend(process.env.RESEND_API_KEY as string);

    const userTasks: Record<string, Task[]> = {};
    tasksToRemind.forEach(task => {
      if (!userTasks[task.assigned_to]) {
        userTasks[task.assigned_to] = [];
      }
      userTasks[task.assigned_to].push(task);
    });

    for (const [userId, tList] of Object.entries(userTasks)) {
      const user = userMap[userId];
      if (!user) continue;

      const tasksHtml = tList.map(t => {
        const deadlineDate = (t.deadline as unknown as Timestamp).toDate();
        const isOverdue = deadlineDate.getTime() < now.getTime();
        const dateStr = deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `<li>
          <strong>${t.description}</strong><br/>
          Status: ${t.status} | Deadline: <span style="color: ${isOverdue ? 'red' : 'inherit'}">${dateStr} ${isOverdue ? '(OVERDUE)' : ''}</span>
        </li>`;
      }).join("");

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Imprint Workforce: Task Reminders</h2>
          <p>Hello ${user.name},</p>
          <p>You have ${tList.length} task(s) that are due tomorrow or became overdue today:</p>
          <ul>
            ${tasksHtml}
          </ul>
          <p>Please log in to the dashboard to update their status.</p>
          <br/>
          <p>Blessings,<br/>The Imprint Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Imprint Workforce <no-reply@zubby.me>", 
          to: user.email,
          subject: `Reminder: You have ${tList.length} task(s) due soon`,
          html,
        });
      } catch (err) {
        console.error("Failed to send email to", user.email, err);
      }
    }
  } catch (error) {
    console.error("Cron Error (Tasks):", error);
  }
}

export async function sendDevotionReminders() {
  console.log("[CRON] Running Devotion Reminders");
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
      console.log("No devotions found for today or tomorrow.");
      return;
    }

    const devotions = devotionSnap.docs.map(doc => doc.data() as DevotionDaily);
    
    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { email: string; name: string }> = {};
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        userMap[doc.id] = { email: data.email, name: data.name };
      }
    });

    const resend = new Resend(process.env.RESEND_API_KEY as string);

    for (const devotion of devotions) {
      if (!devotion.assigned_to) continue;
      
      const user = userMap[devotion.assigned_to];
      if (!user) continue;

      const dayLabel = "Tomorrow";
      const topicStr = devotion.topic ? `Topic: ${devotion.topic}` : "Topic: (Not set yet)";

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Imprint Workforce: Devotion Reminder</h2>
          <p>Hello ${user.name},</p>
          <p>This is a reminder that you are scheduled to lead the Daily Devotion <strong>${dayLabel} (${devotion.date})</strong>.</p>
          <p><strong>${topicStr}</strong></p>
          ${!devotion.teaching_notes ? '<p style="color: #d97706;">Friendly reminder: Please add your teaching notes in the dashboard.</p>' : ''}
          <br/>
          <p>Blessings,<br/>The Imprint Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Imprint Workforce <no-reply@zubby.me>", 
          to: user.email,
          subject: `Reminder: You are leading devotion ${dayLabel}`,
          html,
        });
      } catch (err) {
        console.error("Failed to send email to", user.email, err);
      }
    }
  } catch (error) {
    console.error("Cron Error (Devotion):", error);
  }
}

export async function sendRosterReminders() {
  console.log("[CRON] Running Roster Reminders");
  try {
    const db = getAdminDb();
    const targetSunday = getTargetSundayString();
    
    const rosterSnap = await db
      .collection("roster")
      .where("service_date", "==", targetSunday)
      .get();
      
    if (rosterSnap.empty) {
      console.log("No roster duties assigned for upcoming Sunday.");
      return;
    }

    const assignments = rosterSnap.docs.map(doc => doc.data() as Roster);
    
    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { email: string; name: string }> = {};
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        userMap[doc.id] = { email: data.email, name: data.name };
      }
    });

    const resend = new Resend(process.env.RESEND_API_KEY as string);

    for (const assignment of assignments) {
      const user = userMap[assignment.assigned_to];
      if (!user) continue;

      const dutyLabel = ROSTER_DUTY_LABELS[assignment.duty] || assignment.duty;
      const dateLabel = formatTargetSunday(targetSunday);
      
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Imprint Workforce: Roster Reminder</h2>
          <p>Hello ${user.name},</p>
          <p>This is a reminder that you are scheduled for <strong>${dutyLabel}</strong> for the upcoming service on <strong>${dateLabel}</strong>.</p>
          <p>Please log in to the dashboard if you need more details.</p>
          <br/>
          <p>Blessings,<br/>The Imprint Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Imprint Workforce <no-reply@zubby.me>", 
          to: user.email,
          subject: `Reminder: You are assigned for ${dutyLabel} on ${dateLabel}`,
          html,
        });
      } catch (err) {
        console.error("Failed to send email to", user.email, err);
      }
    }
  } catch (error) {
    console.error("Cron Error (Roster):", error);
  }
}

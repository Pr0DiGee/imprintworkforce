import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import { Task } from "@/types";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const db = getAdminDb();
    
    // We want tasks that are NOT completed.
    const tasksSnap = await db
      .collection("tasks")
      .where("status", "in", ["ASSIGNED", "IN_PROGRESS"])
      .get();
      
    if (tasksSnap.empty) {
      return NextResponse.json({ success: true, message: "No active tasks found." });
    }

    const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    
    // Determine which tasks need reminders.
    // Let's remind if the deadline is today, tomorrow, or in the past (overdue).
    const now = new Date();
    // Normalize 'today' to midnight for comparison
    const todayStr = now.toISOString().split("T")[0];
    const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
    const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;
    
    const tasksToRemind = tasks.filter(task => {
      if (!task.deadline) return false;
      const deadlineDate = (task.deadline as unknown as Timestamp).toDate();
      const deadlineStr = deadlineDate.toISOString().split("T")[0];
      const deadlineMs = new Date(deadlineStr + "T00:00:00Z").getTime();
      
      // Overdue, today, or tomorrow
      return deadlineMs <= tomorrowMs;
    });

    if (tasksToRemind.length === 0) {
      return NextResponse.json({ success: true, message: "No tasks needing reminders today." });
    }

    // Fetch all users
    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { email: string; name: string }> = {};
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        userMap[doc.id] = { email: data.email, name: data.name };
      }
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailsSent = [];

    // Group tasks by user so we don't spam them with multiple emails
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
          <p>You have ${tList.length} task(s) that are due soon or overdue:</p>
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
          from: "Imprint Workforce <onboarding@resend.dev>", 
          to: user.email,
          subject: `Reminder: You have ${tList.length} task(s) due soon`,
          html,
        });
        emailsSent.push(user.email);
      } catch (err) {
        console.error("Failed to send email to", user.email, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: emailsSent.length, 
      sentTo: emailsSent 
    });

  } catch (error) {
    console.error("Cron Error (Tasks):", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

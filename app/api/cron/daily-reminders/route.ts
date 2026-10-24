import { NextResponse } from "next/server";
import { sendTaskReminders, sendDevotionReminders, sendRosterReminders, sendFollowUpReminders, cleanupExpiredRateLimits } from "@/lib/server-crons";
import { sendScheduledCustomPushes } from "@/lib/custom-pushes";
import { createWeeklyCheckups, sendReportReminders } from "@/lib/checkups";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting daily reminders check...");
    
    // 1. Task Reminders run EVERY DAY
    await sendTaskReminders();

    // Housekeeping: old check-in rate-limit records
    await cleanupExpiredRateLimits();

    // Vercel crons run in UTC. We need to evaluate the day in Nigerian time (UTC+1).
    // An easy way is to use toLocaleString with the timeZone option.
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "short" });
    const weekday = formatter.format(now); // e.g. "Sat"

    if (weekday === "Mon") {
      // Monday: draw this week's check-up partners, and remind departments
      // whose Sunday report isn't in (due 8pm tonight). Both are safe to re-run.
      await createWeeklyCheckups(now);
      await sendReportReminders(now);
    }

    // Devotion (Mon–Sat): the day before and on the day
    await sendDevotionReminders(now);

    if (weekday === "Tue") {
      await sendFollowUpReminders(now);
    }

    if (weekday === "Sat") {
      // Sunday duty reminders for tomorrow
      await sendRosterReminders();
    }

    // Custom messages an admin scheduled for today
    await sendScheduledCustomPushes(now);

    console.log("[CRON] Daily reminders check complete.");
    return NextResponse.json({ success: true, message: "Daily reminders processed." });
  } catch (error: any) {
    console.error("[CRON] Daily reminders failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

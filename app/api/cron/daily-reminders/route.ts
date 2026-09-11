import { NextResponse } from "next/server";
import { sendTaskReminders, sendDevotionReminders, sendRosterReminders } from "@/lib/server-crons";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting daily reminders check...");
    
    // 1. Task Reminders run EVERY DAY
    await sendTaskReminders();

    // Get current day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const today = new Date().getDay();

    if (today === 6) {
      // 2. Roster Reminders run ONLY ON SATURDAY (day 6)
      await sendRosterReminders();
    } else {
      // 3. Devotion Reminders run EVERY DAY EXCEPT SATURDAY (days 0-5)
      await sendDevotionReminders();
    }

    console.log("[CRON] Daily reminders check complete.");
    return NextResponse.json({ success: true, message: "Daily reminders processed." });
  } catch (error: any) {
    console.error("[CRON] Daily reminders failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

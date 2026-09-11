import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import { getTargetSundayString } from "@/lib/date";
import { DevotionDaily, Task } from "@/types";

export async function sendTaskReminders() {
  console.log("[CRON] Running Task Reminders");

}

export async function sendDevotionReminders() {
  console.log("[CRON] Running Devotion Reminders");

}

export async function sendRosterReminders() {
  console.log("[CRON] Running Roster Reminders");

}

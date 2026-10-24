import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { can } from "@/lib/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { fetchAllUsers } from "@/lib/server-data";
import { serializeData } from "@/lib/serialize";
import { getLagosToday } from "@/lib/date";
import { getDisabledPushTypes } from "@/lib/push-notifications";
import { NotificationsClient, type CustomPushRow, type LogRow } from "./NotificationsClient";

export const dynamic = "force-dynamic";

const WEEKS_STEP = 4;

/** Start of the log window: `weeks` weeks ago. */
function logWindowStart(weeks: number): Date {
  return new Date(Date.now() - weeks * 7 * 864e5);
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!can(user, "manageNotifications")) redirect("/dashboard");

  const requested = parseInt((await searchParams).weeks ?? "", 10);
  const weeks = Math.min(Math.max(Number.isFinite(requested) ? requested : WEEKS_STEP, WEEKS_STEP), 104);
  const since = logWindowStart(weeks);

  const db = getAdminDb();
  const [disabled, users, logSnap, scheduledSnap] = await Promise.all([
    getDisabledPushTypes(),
    fetchAllUsers(),
    db.collection("push_log").where("created_at", ">=", since).orderBy("created_at", "desc").limit(500).get(),
    db.collection("custom_pushes").where("status", "==", "scheduled").get(),
  ]);

  const log = logSnap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) }) as LogRow);
  const scheduled = scheduledSnap.docs
    .map((d) => ({ id: d.id, ...serializeData(d.data()) }) as CustomPushRow)
    .sort((a, b) => a.send_on.localeCompare(b.send_on));

  return (
    <NotificationsClient
      users={users.map((u) => ({ uid: u.uid, name: u.name, role: u.role, departments: u.departments ?? [] }))}
      disabled={disabled}
      log={log}
      scheduled={scheduled}
      weeks={weeks}
      nextWeeks={weeks + WEEKS_STEP}
      today={getLagosToday().date}
    />
  );
}

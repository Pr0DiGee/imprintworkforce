import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import {
  fetchDashboardStats,
  fetchRosterForSunday,
  fetchDevotionForDates,
  fetchUserMap,
} from "@/lib/server-data";
import {
  getTargetSundayString,
  addWeeksToDate,
  getMondayOfWeek,
  getMonToSatDates,
} from "@/lib/date";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const currentSunday = getTargetSundayString();
  const upcomingSunday = addWeeksToDate(currentSunday, 1);
  const currentMonday = getMondayOfWeek(currentSunday);
  const weekDays = getMonToSatDates(currentMonday);

  const [stats, roster, devotions, users] = await Promise.all([
    fetchDashboardStats(user, currentSunday),
    fetchRosterForSunday(upcomingSunday),
    fetchDevotionForDates(weekDays),
    fetchUserMap(),
  ]);

  return (
    <DashboardClient
      user={user}
      stats={stats}
      roster={roster}
      devotions={devotions}
      users={users}
      currentSunday={currentSunday}
      upcomingSunday={upcomingSunday}
      weekDays={weekDays}
    />
  );
}

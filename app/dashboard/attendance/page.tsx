import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { getTargetSundayString } from "@/lib/sunday";
import { fetchAttendeesForSunday } from "@/lib/server-data";
import { can } from "@/lib/permissions";
import { AttendanceClient } from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ sunday?: string }> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!can(user, "manageAttendance")) redirect("/dashboard");

  // Only the people who came on this Sunday
  const currentSunday = (await searchParams).sunday || getTargetSundayString();
  const attendees = await fetchAttendeesForSunday(currentSunday);

  return <AttendanceClient attendees={attendees} currentSunday={currentSunday} />;
}

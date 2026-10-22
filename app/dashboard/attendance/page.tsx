import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { getTargetSundayString } from "@/lib/sunday";
import { countMembers, fetchAttendanceForSunday } from "@/lib/server-data";
import { AttendanceClient } from "./AttendanceClient";

import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ sunday?: string }> }) {
  const user = await getServerUser();
  const params = await searchParams;
  if (!user) redirect("/login");
  
  if (!can(user, "manageAttendance")) {
    redirect("/dashboard");
  }

  // Only who checked in this Sunday is loaded up front; the full congregation
  // is paged / searched on demand from the client (see ./actions.ts).
  const currentSunday = params.sunday || getTargetSundayString();
  const [{ members }, totalMembers] = await Promise.all([
    fetchAttendanceForSunday(currentSunday),
    countMembers(),
  ]);

  return <AttendanceClient checkedIn={members} totalMembers={totalMembers} currentSunday={currentSunday} />;
}

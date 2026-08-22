import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchReportsForSunday, fetchUserMap } from "@/lib/server-data";
import { getTargetSundayString } from "@/lib/date";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const currentSunday = getTargetSundayString();
  const departments = user.departments ?? [];

  // Fetch the current sunday's reports for the user's departments
  const reports = await fetchReportsForSunday(currentSunday);
  const myReport =
    departments.length > 0
      ? reports.find((r) => departments.includes(r.department)) ?? null
      : null;

  return (
    <ReportsClient
      user={user}
      currentSunday={currentSunday}
      initialReport={myReport}
    />
  );
}

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { can } from "@/lib/permissions";
import { fetchReportCountsByWeek } from "@/lib/server-data";
import { ReportsHistoryClient } from "./ReportsHistoryClient";

const WEEKS_STEP = 12;

export default async function ReportsHistoryPage({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  if (!can(user, "viewAllReports")) {
    redirect("/dashboard");
  }

  const requested = parseInt((await searchParams).weeks ?? "", 10);
  const weeks = Math.min(Math.max(Number.isFinite(requested) ? requested : WEEKS_STEP, WEEKS_STEP), 260);
  const history = await fetchReportCountsByWeek(weeks);

  return <ReportsHistoryClient history={history} weeks={weeks} nextWeeks={weeks + WEEKS_STEP} />;
}

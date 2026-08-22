import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { isPastor } from "@/lib/roles";
import { fetchAllReportSundays } from "@/lib/server-data";
import { ReportsHistoryClient } from "./ReportsHistoryClient";

export default async function ReportsHistoryPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  if (!isPastor(user.role)) {
    redirect("/dashboard");
  }

  const history = await fetchAllReportSundays();

  return <ReportsHistoryClient history={history} />;
}

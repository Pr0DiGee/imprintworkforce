import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { isPastor } from "@/lib/roles";
import { fetchReportsForSunday } from "@/lib/server-data";
import { getTargetSundayString } from "@/lib/date";
import { ReportsAllClient } from "./ReportsAllClient";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AllReportsPage({ searchParams }: PageProps) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  // Only pastors can view all reports
  if (!isPastor(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : null;
  const targetSunday = dateParam || getTargetSundayString();

  const reportsList = await fetchReportsForSunday(targetSunday);

  return (
    <ReportsAllClient
      targetSunday={targetSunday}
      initialReportsList={reportsList}
    />
  );
}

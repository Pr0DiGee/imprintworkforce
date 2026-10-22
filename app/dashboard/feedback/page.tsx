import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchFeedbackForSunday, fetchUserMap } from "@/lib/server-data";
import { getTargetSundayString } from "@/lib/date";
import { can } from "@/lib/permissions";
import { FeedbackClient } from "./FeedbackClient";

export default async function FeedbackPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const currentSunday = getTargetSundayString();
  const [allFeedback, usersMap] = await Promise.all([
    fetchFeedbackForSunday(currentSunday),
    fetchUserMap(),
  ]);
  const myFeedback = allFeedback.find((f) => f.user_id === user.uid) ?? null;

  return (
    <FeedbackClient
      user={user}
      currentSunday={currentSunday}
      initialMyFeedback={myFeedback}
      initialAllFeedback={allFeedback}
      usersMap={usersMap}
      isPastor={can(user, "viewAllReports")}
    />
  );
}

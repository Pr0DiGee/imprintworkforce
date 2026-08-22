import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchFeedbackForSunday, fetchUserMap } from "@/lib/server-data";
import { getTargetSundayString } from "@/lib/date";
import { isPastor } from "@/lib/roles";
import { FeedbackClient } from "./FeedbackClient";

export default async function FeedbackPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const currentSunday = getTargetSundayString();
  const allFeedback = await fetchFeedbackForSunday(currentSunday);
  
  const myFeedback = allFeedback.find((f) => f.user_id === user.uid) ?? null;
  const usersMap = await fetchUserMap();

  return (
    <FeedbackClient
      user={user}
      currentSunday={currentSunday}
      initialMyFeedback={myFeedback}
      initialAllFeedback={allFeedback}
      usersMap={usersMap}
      isPastor={isPastor(user.role)}
    />
  );
}

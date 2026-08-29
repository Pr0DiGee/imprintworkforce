import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchFollowUpContacts, fetchFollowUpLogs, fetchUserMap } from "@/lib/server-data";
import { getTargetSundayString } from "@/lib/date";
import { FollowUpClient } from "./FollowUpClient";

export default async function FollowUpPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [contacts, logs, userMap] = await Promise.all([
    fetchFollowUpContacts(),
    fetchFollowUpLogs(),
    fetchUserMap(),
  ]);

  const targetSunday = getTargetSundayString();

  return (
    <FollowUpClient
      user={user}
      contacts={contacts}
      logs={logs}
      userMap={userMap}
      targetSunday={targetSunday}
    />
  );
}

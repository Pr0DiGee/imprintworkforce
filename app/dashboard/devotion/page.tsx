import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { getTargetSundayString } from "@/lib/sunday";
import { getMondayOfWeek, getMonToSatDates } from "@/lib/date";
import { fetchAllUsers, fetchDevotionForDates } from "@/lib/server-data";
import { DevotionDaily } from "@/types";
import { DevotionClient } from "./DevotionClient";
import { can } from "@/lib/permissions";


export default async function DevotionPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const targetMonday = getMondayOfWeek(getTargetSundayString());
  const days = getMonToSatDates(targetMonday);
  
  const devMap = await fetchDevotionForDates(days);

  const users = await fetchAllUsers();
  users.sort((a, b) => a.name.localeCompare(b.name));

  const hasPermission = can(user, "editDevotion");

  return (
    <DevotionClient
      user={user}
      initialDevotions={devMap}
      users={users}
      initialTargetMonday={targetMonday}
      hasPermission={hasPermission}
    />
  );
}

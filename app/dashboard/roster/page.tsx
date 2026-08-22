import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchAllUsers } from "@/lib/server-data";
import { getTargetSundayString, addWeeksToDate } from "@/lib/date";
import { getAdminDb } from "@/lib/firebase/admin";
import { Roster, RosterDuty, ROSTER_DUTIES } from "@/types";
import { RosterClient } from "./RosterClient";
import { canEditRoster } from "@/lib/roles";

export default async function RosterPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const currentWindowSunday = getTargetSundayString();
  const stripDates = [
    currentWindowSunday,
    addWeeksToDate(currentWindowSunday, 1),
    addWeeksToDate(currentWindowSunday, 2),
    addWeeksToDate(currentWindowSunday, 3),
    addWeeksToDate(currentWindowSunday, 4),
  ];

  const db = getAdminDb();
  
  // Pre-fetch all 5 Sundays
  const allSlots: Record<string, Record<RosterDuty, Roster | null>> = {};

  await Promise.all(
    stripDates.map(async (date) => {
      const slotEntries = await Promise.all(
        ROSTER_DUTIES.map(async (duty) => {
          const snap = await db.collection("roster").doc(`${date}_${duty}`).get();
          return [duty, snap.exists ? ({ id: snap.id, ...snap.data() } as Roster) : null] as const;
        })
      );
      allSlots[date] = Object.fromEntries(slotEntries) as Record<RosterDuty, Roster | null>;
    })
  );

  const users = await fetchAllUsers();
  users.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <RosterClient
      user={user}
      initialSlots={allSlots}
      users={users}
      stripDates={stripDates}
      currentWindowSunday={currentWindowSunday}
      canEdit={canEditRoster(user.role)}
    />
  );
}

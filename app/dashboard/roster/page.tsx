import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchAllUsers } from "@/lib/server-data";
import { getTargetSundayString, addWeeksToDate } from "@/lib/date";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeData } from "@/lib/serialize";
import { Roster, RosterDuty, ROSTER_DUTIES } from "@/types";
import { RosterClient } from "./RosterClient";
import { can } from "@/lib/permissions";

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

  // One query for all 5 Sundays, alongside the user list
  const [rosterSnap, users] = await Promise.all([
    getAdminDb().collection("roster").where("service_date", "in", stripDates).get(),
    fetchAllUsers(),
  ]);

  const allSlots: Record<string, Record<RosterDuty, Roster | null>> = Object.fromEntries(
    stripDates.map((date) => [date, Object.fromEntries(ROSTER_DUTIES.map((duty) => [duty, null])) as Record<RosterDuty, Roster | null>])
  );
  rosterSnap.docs.forEach((doc) => {
    const slot = { id: doc.id, ...serializeData(doc.data()) } as Roster;
    if (allSlots[slot.service_date] && ROSTER_DUTIES.includes(slot.duty)) {
      allSlots[slot.service_date][slot.duty] = slot;
    }
  });

  return (
    <RosterClient
      user={user}
      initialSlots={allSlots}
      users={users}
      stripDates={stripDates}
      currentWindowSunday={currentWindowSunday}
      canEdit={can(user, "editRoster")}
    />
  );
}

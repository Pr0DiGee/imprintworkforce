import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { CongregationMember, AttendanceRecord } from "@/types";
import { getTargetSundayString } from "@/lib/sunday";
import { AttendanceClient } from "./AttendanceClient";

import { isPastor } from "@/lib/roles";

export default async function AttendancePage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  
  if (!isPastor(user.role)) {
    redirect("/dashboard");
  }

  const db = getAdminDb();
  
  const membersSnap = await db.collection("congregation").get();
  const members: CongregationMember[] = membersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      birthday: data.birthday,
      address: data.address,
      created_at: data.created_at?.toDate().toISOString(),
      last_checkin: data.last_checkin?.toDate().toISOString(),
    } as any;
  });

  const currentSunday = getTargetSundayString();
  const attendanceSnap = await db.collection("attendance").where("service_date", "==", currentSunday).get();
  const todayAttendance: AttendanceRecord[] = attendanceSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      member_id: data.member_id,
      service_date: data.service_date,
      checked_in_at: data.checked_in_at?.toDate().toISOString(),
    } as any;
  });

  return <AttendanceClient members={members} todayAttendance={todayAttendance} currentSunday={currentSunday} />;
}

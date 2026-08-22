import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase/admin";
import { CongregationMember } from "@/types";
import { CheckInClient } from "./CheckInClient";
import { getTargetSundayString } from "@/lib/sunday";

export default async function CheckInPage() {
  const cookieStore = await cookies();
  const memberIdCookie = cookieStore.get("iw_member_id");
  let member: CongregationMember | null = null;

  if (memberIdCookie?.value) {
    const db = getAdminDb();
    const memberDoc = await db.collection("congregation").doc(memberIdCookie.value).get();
    
    if (memberDoc.exists) {
      const data = memberDoc.data();
      member = {
        id: memberDoc.id,
        name: data?.name || "",
        phone: data?.phone || "",
        email: data?.email,
        birthday: data?.birthday,
        address: data?.address,
      };
    }
  }

  const targetSunday = getTargetSundayString();

  return (
    <CheckInClient 
      initialMember={member} 
      targetSunday={targetSunday} 
    />
  );
}

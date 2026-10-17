import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase/admin";
import { getLagosToday } from "@/lib/date";
import { firstName } from "@/lib/phone";
import { CheckInClient } from "./CheckInClient";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const fake = process.env.NODE_ENV !== "production" ? process.env.CHECKIN_TEST_NOW : undefined;
  const today = getLagosToday(fake ? new Date(fake) : new Date());
  const memberId = (await cookies()).get("iw_member_id")?.value;

  // Only the first name ever reaches the browser
  let rememberedName: string | null = null;
  if (memberId && !memberId.includes("/")) {
    const snap = await getAdminDb().collection("congregation").doc(memberId).get();
    if (snap.exists) rememberedName = firstName(snap.data()?.name ?? "");
  }

  return <CheckInClient isSunday={today.isSunday} rememberedName={rememberedName} />;
}

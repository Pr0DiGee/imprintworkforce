/**
 * Private per-user details (currently: phone number) live in `user_private/{uid}`,
 * separate from `users/{uid}`, which every signed-in user can read. Browsers
 * can't read or write this collection at all (see firestore.rules); only the
 * server does, and it only reveals a number to that person's check-up partner
 * for the current week.
 */
import { getAdminDb } from "@/lib/firebase/admin";

export async function getPrivatePhone(uid: string): Promise<string | null> {
  const snap = await getAdminDb().collection("user_private").doc(uid).get();
  return (snap.data()?.phone as string | undefined) || null;
}

export async function setPrivatePhone(uid: string, phone: string | null, phoneNormalized: string | null) {
  await getAdminDb().collection("user_private").doc(uid).set(
    { phone: phone || null, phone_normalized: phoneNormalized || null, updated_at: new Date() },
    { merge: true }
  );
}

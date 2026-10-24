"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { createMember, findMemberByPhone, normalizeBirthday, recordAttendance } from "@/lib/attendance";
import { getTargetSundayString } from "@/lib/date";

/** Ushers and pastors correct a congregation member's details. */
export async function updateMember(
  memberId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAttendance")) return { error: "Unauthorized" };
  if (!memberId || memberId.includes("/")) return { error: "Invalid member" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const birthday = String(formData.get("birthday") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim().slice(0, 200);

  const normalized = normalizePhone(phone);
  if (!name) return { error: "Name is required." };
  if (!normalized) return { error: "Please enter a valid phone number." };
  const birthdayValue = birthday ? normalizeBirthday(birthday) : null;
  if (birthday && !birthdayValue) return { error: "Please choose a valid birthday (day and month)." };

  try {
    const col = getAdminDb().collection("congregation");
    const ref = col.doc(memberId);
    if (!(await ref.get()).exists) return { error: "Member not found." };

    // Two members can't share a phone number, or check-in can't tell them apart
    const clash = await col.where("phone_normalized", "==", normalized).limit(2).get();
    if (clash.docs.some((d) => d.id !== memberId)) {
      return { error: "Another member already uses this phone number." };
    }

    await ref.update({
      name,
      phone,
      phone_normalized: normalized,
      name_lower: name.toLowerCase(),
      email: email || null,
      birthday: birthdayValue,
      address: address || null,
      updated_by: user.uid,
    });

    revalidatePath("/dashboard/attendance");
    return { success: true };
  } catch (err) {
    console.error("[updateMember]", err);
    return { error: "Failed to save changes." };
  }
}

export type StaffCheckInResult =
  | { success: true; firstName: string; alreadyCheckedIn: boolean; existingMember?: boolean }
  | { error: string; notFound?: boolean };

/** A real Sunday, not in the future (staff may record a past Sunday they forgot). */
function validSunday(sunday: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sunday)) return false;
  if (new Date(`${sunday}T12:00:00Z`).getUTCDay() !== 0) return false;
  return sunday <= getTargetSundayString();
}

/** Usher/admin checks in a regular member who has no phone with them: phone number only. */
export async function staffCheckInRegular(sunday: string, phone: string): Promise<StaffCheckInResult> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAttendance")) return { error: "Unauthorized" };
  if (!validSunday(sunday)) return { error: "Invalid Sunday." };

  const normalized = normalizePhone(String(phone ?? ""));
  if (!normalized) return { error: "Please enter a valid phone number." };

  try {
    const ref = await findMemberByPhone(normalized);
    if (!ref) return { error: "No member has that number. Use “First timer” to add them.", notFound: true };
    const result = await recordAttendance(ref, sunday, user.uid);
    revalidatePath("/dashboard/attendance");
    return { success: true, firstName: result.firstName, alreadyCheckedIn: result.status === "already_checked_in" };
  } catch (err) {
    console.error("[staffCheckInRegular]", err);
    return { error: "Check-in failed. Please try again." };
  }
}

/** Usher/admin registers a first timer and checks them in: name, phone, optional birthday. */
export async function staffCheckInFirstTimer(sunday: string, formData: FormData): Promise<StaffCheckInResult> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAttendance")) return { error: "Unauthorized" };
  if (!validSunday(sunday)) return { error: "Invalid Sunday." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const normalized = normalizePhone(phone);
  const birthdayValue = birthday ? normalizeBirthday(birthday) : null;
  if (!name) return { error: "Please enter their name." };
  if (!normalized) return { error: "Please enter a valid phone number." };
  if (birthday && !birthdayValue) return { error: "Please choose a valid birthday (day and month)." };

  try {
    // Already registered under this number: check that member in instead, details untouched
    const existing = await findMemberByPhone(normalized);
    const ref = existing ?? (await createMember({ name, phone, phoneNormalized: normalized, birthday: birthdayValue, createdBy: user.uid }));
    const result = await recordAttendance(ref, sunday, user.uid);
    revalidatePath("/dashboard/attendance");
    return {
      success: true,
      firstName: result.firstName,
      alreadyCheckedIn: result.status === "already_checked_in",
      existingMember: Boolean(existing),
    };
  } catch (err) {
    console.error("[staffCheckInFirstTimer]", err);
    return { error: "Check-in failed. Please try again." };
  }
}

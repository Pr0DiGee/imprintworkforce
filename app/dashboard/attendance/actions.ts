"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { fetchMemberPage, searchMembers } from "@/lib/server-data";
import type { CongregationMember } from "@/types";

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
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return { error: "Invalid birthday." };

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
      birthday: birthday || null,
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

/** Next page of the congregation (A→Z) for the "All members" view. */
export async function loadMemberPage(
  after?: { name: string; id: string }
): Promise<{ members: CongregationMember[]; hasMore: boolean } | { error: string }> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAttendance")) return { error: "Unauthorized" };
  return fetchMemberPage(after);
}

/** Search the whole congregation by name or phone. */
export async function findMembers(query: string): Promise<CongregationMember[]> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAttendance")) return [];
  return searchMembers(String(query ?? "").slice(0, 50));
}

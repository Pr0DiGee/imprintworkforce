"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { deleteWhere } from "@/lib/server-cleanup";

/** Delete a follow-up contact together with every log recorded against it. */
export async function deleteFollowUpContact(
  contactId: string
): Promise<{ success: true; logsDeleted: number } | { error: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Unauthorized" };
  if (!contactId || contactId.includes("/")) return { error: "Invalid contact" };

  try {
    const db = getAdminDb();
    const ref = db.collection("followup_contacts").doc(contactId);
    const snap = await ref.get();
    if (!snap.exists) return { error: "Contact not found." };

    // Same rule as firestore.rules: the assigned worker, or someone who manages all follow-ups
    if (snap.data()?.assigned_to !== user.uid && !can(user, "manageAllFollowUps")) {
      return { error: "You can only delete contacts assigned to you." };
    }

    const logsDeleted = await deleteWhere(db.collection("followup_logs").where("contact_id", "==", contactId));
    await ref.delete();

    revalidatePath("/dashboard/followup");
    revalidatePath("/dashboard");
    return { success: true, logsDeleted };
  } catch (err) {
    console.error("[deleteFollowUpContact]", err);
    return { error: "Failed to delete contact." };
  }
}

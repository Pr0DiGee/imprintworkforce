"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { can } from "@/lib/permissions";
import { deleteWhere } from "@/lib/server-cleanup";
import { FieldValue } from "firebase-admin/firestore";
import { getTargetSundayString } from "@/lib/date";
import { serializeData } from "@/lib/serialize";
import type { FollowUpLog, FollowUpMethod } from "@/types";

const FOLLOW_UP_METHODS: FollowUpMethod[] = ["PHYSICAL", "CALL", "TEXT"];

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

/** Pastors/admins hand a contact to another worker (e.g. after the old one was deleted). */
export async function reassignFollowUpContact(
  contactId: string,
  newAssigneeUid: string
): Promise<{ success: true } | { error: string }> {
  const user = await getServerUser();
  if (!user || !can(user, "manageAllFollowUps")) return { error: "Unauthorized" };
  if (!contactId || contactId.includes("/") || !newAssigneeUid || newAssigneeUid.includes("/")) {
    return { error: "Invalid request" };
  }

  try {
    const db = getAdminDb();
    const [contact, assignee] = await Promise.all([
      db.collection("followup_contacts").doc(contactId).get(),
      db.collection("users").doc(newAssigneeUid).get(),
    ]);
    if (!contact.exists) return { error: "Contact not found." };
    if (!assignee.exists) return { error: "That worker no longer exists." };

    await contact.ref.update({ assigned_to: newAssigneeUid });
    revalidatePath("/dashboard/followup");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[reassignFollowUpContact]", err);
    return { error: "Failed to reassign contact." };
  }
}

/**
 * Record a follow-up and update the contact's summary in one batch, so
 * lists can show "last contacted" and "done this week" without loading logs.
 */
export async function logFollowUp(
  contactId: string,
  method: FollowUpMethod,
  notes: string
): Promise<{ success: true } | { error: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Unauthorized" };
  if (!contactId || contactId.includes("/")) return { error: "Invalid contact" };
  if (!FOLLOW_UP_METHODS.includes(method)) return { error: "Invalid method" };

  try {
    const db = getAdminDb();
    const contactRef = db.collection("followup_contacts").doc(contactId);
    const contact = await contactRef.get();
    if (!contact.exists) return { error: "Contact not found." };
    if (contact.data()?.assigned_to !== user.uid && !can(user, "manageAllFollowUps")) {
      return { error: "You can only log follow-ups for your own contacts." };
    }

    const trimmed = String(notes ?? "").trim().slice(0, 2000);
    const sunday = getTargetSundayString();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(db.collection("followup_logs").doc(), {
      contact_id: contactId,
      worker_id: user.uid,
      method,
      notes: trimmed,
      target_sunday: sunday,
      logged_at: now,
    });
    batch.update(contactRef, {
      last_log_at: now,
      last_log_method: method,
      last_log_notes: trimmed,
      last_log_by: user.uid,
      last_log_sunday: sunday,
      log_count: FieldValue.increment(1),
    });
    await batch.commit();

    revalidatePath("/dashboard/followup");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[logFollowUp]", err);
    return { error: "Failed to log follow-up." };
  }
}

/** Full history for one contact, loaded only when someone opens it. */
export async function getFollowUpHistory(contactId: string): Promise<FollowUpLog[]> {
  const user = await getServerUser();
  if (!user || !contactId || contactId.includes("/")) return [];
  const snap = await getAdminDb()
    .collection("followup_logs")
    .where("contact_id", "==", contactId)
    .orderBy("logged_at", "desc")
    .limit(100)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeData(d.data()) } as FollowUpLog));
}

import type { Query, UpdateData, DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch

/** Delete every document matching a query, in batches. Returns how many were deleted. */
export async function deleteWhere(query: Query): Promise<number> {
  const db = getAdminDb();
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/** Apply the same update to every document matching a query, in batches. Returns how many changed. */
export async function updateWhere(query: Query, data: UpdateData<DocumentData>): Promise<number> {
  const db = getAdminDb();
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.update(d.ref, data));
    await batch.commit();
  }
  return snap.size;
}

/**
 * Server-only attendance logic shared by the public check-in (app/checkin)
 * and staff check-in on the Attendance page (app/dashboard/attendance).
 */
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { firstName, legacyPhoneVariants } from "@/lib/phone";

export type RecordResult = {
  status: "checked_in" | "already_checked_in";
  firstName: string;
  /** 1 = first visit, 2 = second, … (as of this Sunday) */
  visitNumber: number;
};

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Birthdays are stored as "MM-DD" (no year: people needn't share it).
 * Accepts "MM-DD" or an older "YYYY-MM-DD"; returns null if empty/invalid.
 */
export function normalizeBirthday(input: string | null | undefined): string | null {
  const value = String(input ?? "").trim();
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > MONTH_DAYS[month - 1]) return null;
  return `${match[1]}-${match[2]}`;
}

/** Find a member by normalised phone, including records saved before numbers were normalised. */
export async function findMemberByPhone(normalized: string): Promise<DocumentReference | null> {
  const col = getAdminDb().collection("congregation");

  const match = await col.where("phone_normalized", "==", normalized).limit(1).get();
  if (!match.empty) return match.docs[0].ref;

  const legacy = await col.where("phone", "in", legacyPhoneVariants(normalized)).limit(1).get();
  if (legacy.empty) return null;
  await legacy.docs[0].ref.update({ phone_normalized: normalized }); // next lookup is direct
  return legacy.docs[0].ref;
}

/** Create a congregation member (does not record attendance). */
export async function createMember(fields: {
  name: string;
  phone: string;
  phoneNormalized: string;
  email?: string | null;
  birthday?: string | null;
  address?: string | null;
  createdBy?: string;
}): Promise<DocumentReference> {
  const ref = getAdminDb().collection("congregation").doc();
  await ref.set({
    name: fields.name,
    name_lower: fields.name.toLowerCase(),
    phone: fields.phone,
    phone_normalized: fields.phoneNormalized,
    email: fields.email || null,
    birthday: fields.birthday || null,
    address: fields.address || null,
    created_at: FieldValue.serverTimestamp(),
    attendance_count: 0,
    ...(fields.createdBy ? { created_by: fields.createdBy } : {}),
  });
  return ref;
}

/**
 * Record one attendance for a member on a Sunday (at most once per Sunday).
 * The record stores which visit this was, so "first timer / second timer"
 * labels stay correct when looking back at past Sundays.
 */
export async function recordAttendance(
  memberRef: DocumentReference,
  sunday: string,
  checkedInBy?: string
): Promise<RecordResult> {
  const db = getAdminDb();
  const attendanceRef = db.collection("attendance").doc(`${memberRef.id}_${sunday}`);

  // Records made before deterministic ids existed have random ids
  const legacy = await db
    .collection("attendance")
    .where("member_id", "==", memberRef.id)
    .where("service_date", "==", sunday)
    .limit(1)
    .get();

  try {
    return await db.runTransaction(async (tx) => {
      const [member, existing] = await Promise.all([tx.get(memberRef), tx.get(attendanceRef)]);
      const name = firstName(member.data()?.name ?? "");
      if (existing.exists || !legacy.empty) {
        const prior = existing.data()?.visit_number ?? legacy.docs[0]?.data().visit_number ?? 0;
        return { status: "already_checked_in" as const, firstName: name, visitNumber: prior };
      }

      const visitNumber = (member.data()?.attendance_count ?? 0) + 1;
      tx.create(attendanceRef, {
        member_id: memberRef.id,
        service_date: sunday,
        visit_number: visitNumber,
        checked_in_at: FieldValue.serverTimestamp(),
        ...(checkedInBy ? { checked_in_by: checkedInBy } : {}),
      });
      tx.update(memberRef, {
        last_checkin: FieldValue.serverTimestamp(),
        attendance_count: FieldValue.increment(1),
      });
      return { status: "checked_in" as const, firstName: name, visitNumber };
    });
  } catch (err: unknown) {
    // Lost a race with a simultaneous check-in for the same Sunday
    if ((err as { code?: number })?.code === 6) {
      const data = (await attendanceRef.get()).data();
      const name = firstName((await memberRef.get()).data()?.name ?? "");
      return { status: "already_checked_in", firstName: name, visitNumber: data?.visit_number ?? 0 };
    }
    throw err;
  }
}

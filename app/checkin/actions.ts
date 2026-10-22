"use server";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getLagosToday } from "@/lib/date";
import { firstName, legacyPhoneVariants, normalizePhone } from "@/lib/phone";

// Public check-in (no login). Rules for this flow:
// - only works on Sundays, Lagos time; the date is decided here, never by the browser
// - never returns stored details, only the member's first name
// - never edits an existing member (ushers do that from the Attendance page)
// - one attendance record per member per Sunday

export type CheckInResult =
  | { status: "checked_in" | "already_checked_in"; firstName: string }
  | { status: "not_found" }
  | { status: "closed" }
  | { status: "error"; message: string };

const MEMBER_COOKIE = "iw_member_id";

/** Church-time date for check-in. CHECKIN_TEST_NOW (dev only) fakes the clock for testing. */
function checkInDay() {
  const fake = process.env.NODE_ENV !== "production" ? process.env.CHECKIN_TEST_NOW : undefined;
  return getLagosToday(fake ? new Date(fake) : new Date());
}
const RATE_LIMIT = 100; // phone lookups / sign-ups per network address...
const RATE_WINDOW_MINUTES = 10; // ...per this many minutes

async function rememberDevice(memberId: string) {
  const cookieStore = await cookies();
  cookieStore.set(MEMBER_COOKIE, memberId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

/** Throttle phone lookups so nobody can try number after number to collect names. */
async function withinRateLimit(): Promise<boolean> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() || headerList.get("x-real-ip") || "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const windowId = Math.floor(Date.now() / (RATE_WINDOW_MINUTES * 60 * 1000));

  const ref = getAdminDb().collection("checkin_rate_limits").doc(`${ipHash}_${windowId}`);
  const count = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.data()?.count ?? 0) + 1;
    tx.set(ref, { count: next, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    return next;
  });
  return count <= RATE_LIMIT;
}

/** Find a member by phone, including records saved before numbers were normalised. */
async function findMemberByPhone(normalized: string): Promise<DocumentReference | null> {
  const col = getAdminDb().collection("congregation");

  const match = await col.where("phone_normalized", "==", normalized).limit(1).get();
  if (!match.empty) return match.docs[0].ref;

  const legacy = await col.where("phone", "in", legacyPhoneVariants(normalized)).limit(1).get();
  if (legacy.empty) return null;
  // Backfill so the next lookup is a direct match
  await legacy.docs[0].ref.update({ phone_normalized: normalized });
  return legacy.docs[0].ref;
}

/** Record attendance once per Sunday and bump the member's visit count. */
async function recordAttendance(memberRef: DocumentReference, name: string, sunday: string): Promise<CheckInResult> {
  const db = getAdminDb();

  // Records made before this change have random ids, so check for those too
  const legacy = await db
    .collection("attendance")
    .where("member_id", "==", memberRef.id)
    .where("service_date", "==", sunday)
    .limit(1)
    .get();
  if (!legacy.empty) return { status: "already_checked_in", firstName: firstName(name) };

  try {
    await db.collection("attendance").doc(`${memberRef.id}_${sunday}`).create({
      member_id: memberRef.id,
      service_date: sunday,
      checked_in_at: FieldValue.serverTimestamp(),
    });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 6) {
      return { status: "already_checked_in", firstName: firstName(name) };
    }
    throw err;
  }

  await memberRef.update({
    last_checkin: FieldValue.serverTimestamp(),
    attendance_count: FieldValue.increment(1),
  });
  return { status: "checked_in", firstName: firstName(name) };
}

/** Check in the member this device remembers (from the cookie). */
export async function checkInRemembered(): Promise<CheckInResult> {
  try {
    const today = checkInDay();
    if (!today.isSunday) return { status: "closed" };

    const memberId = (await cookies()).get(MEMBER_COOKIE)?.value;
    if (!memberId || memberId.includes("/")) return { status: "not_found" };

    const ref = getAdminDb().collection("congregation").doc(memberId);
    const snap = await ref.get();
    if (!snap.exists) {
      (await cookies()).delete(MEMBER_COOKIE);
      return { status: "not_found" };
    }
    return await recordAttendance(ref, snap.data()!.name ?? "", today.date);
  } catch (error) {
    console.error("[checkInRemembered]", error);
    return { status: "error", message: "Check-in failed. Please try again." };
  }
}

/** Check in by phone number. Reveals only the first name of a matching member. */
export async function checkInByPhone(phone: string): Promise<CheckInResult> {
  try {
    const today = checkInDay();
    if (!today.isSunday) return { status: "closed" };

    const normalized = normalizePhone(String(phone ?? ""));
    if (!normalized) return { status: "error", message: "Please enter a valid phone number." };

    if (!(await withinRateLimit())) {
      return { status: "error", message: "Too many attempts. Please ask an usher for help." };
    }

    const ref = await findMemberByPhone(normalized);
    if (!ref) return { status: "not_found" };

    const snap = await ref.get();
    const result = await recordAttendance(ref, snap.data()?.name ?? "", today.date);
    await rememberDevice(ref.id);
    return result;
  } catch (error) {
    console.error("[checkInByPhone]", error);
    return { status: "error", message: "Check-in failed. Please try again." };
  }
}

/** First visit: create the member and check them in. Existing numbers are never overwritten. */
export async function registerAndCheckIn(formData: FormData): Promise<CheckInResult> {
  try {
    const today = checkInDay();
    if (!today.isSunday) return { status: "closed" };

    const name = String(formData.get("name") ?? "").trim().slice(0, 100);
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().slice(0, 200);
    const birthday = String(formData.get("birthday") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim().slice(0, 200);

    const normalized = normalizePhone(phone);
    if (!name) return { status: "error", message: "Please enter your name." };
    if (!normalized) return { status: "error", message: "Please enter a valid phone number." };
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return { status: "error", message: "Please enter a valid birthday." };
    }

    if (!(await withinRateLimit())) {
      return { status: "error", message: "Too many attempts. Please ask an usher for help." };
    }

    // Number already registered: just check that member in, don't touch their details
    const existing = await findMemberByPhone(normalized);
    if (existing) {
      const snap = await existing.get();
      const result = await recordAttendance(existing, snap.data()?.name ?? "", today.date);
      await rememberDevice(existing.id);
      return result;
    }

    const ref = getAdminDb().collection("congregation").doc();
    await ref.set({
      name,
      phone,
      phone_normalized: normalized,
      name_lower: name.toLowerCase(),
      email: email || null,
      birthday: birthday || null,
      address: address || null,
      created_at: FieldValue.serverTimestamp(),
      attendance_count: 0,
    });

    const result = await recordAttendance(ref, name, today.date);
    await rememberDevice(ref.id);
    return result;
  } catch (error) {
    console.error("[registerAndCheckIn]", error);
    return { status: "error", message: "Check-in failed. Please try again." };
  }
}

/** "Not you?" — forget the member remembered on this device. */
export async function forgetDevice(): Promise<void> {
  (await cookies()).delete(MEMBER_COOKIE);
}

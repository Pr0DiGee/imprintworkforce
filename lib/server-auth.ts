import crypto from "crypto";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeData } from "@/lib/server-data";
import type { UserProfile } from "@/types";

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Verify the HMAC-signed session cookie and return the decoded UID.
 * Returns null if the cookie is missing, invalid, or expired.
 */
export function verifySessionCookie(
  token: string
): { uid: string; timestamp: number } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [uid, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (!uid || isNaN(timestamp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > SESSION_DURATION_SECONDS) return null;

  const payload = `${uid}.${timestampStr}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  return { uid, timestamp };
}

/**
 * Get the current authenticated user's profile from a Server Component.
 * Reads the session cookie, verifies it, and fetches the Firestore profile.
 * Returns null if not authenticated.
 */
export async function getServerUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  const session = verifySessionCookie(token);
  if (!session) return null;

  try {
    const db = getAdminDb();
    const snap = await db.collection("users").doc(session.uid).get();

    if (!snap.exists) return null;

    return { uid: snap.id, ...serializeData(snap.data()) } as UserProfile;
  } catch (err) {
    console.error("[getServerUser] Failed to fetch profile:", err);
    return null;
  }
}

import crypto from "crypto";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeData } from "@/lib/serialize";
import type { UserProfile } from "@/types";

// The `session` cookie is "uid.issuedAtSeconds.hmacSha256", signed with SESSION_SECRET.
// It is our own cookie, not a Firebase session cookie.

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

/** Create a signed session token for a user, issued now. */
export function signSessionCookie(uid: string): string {
  const payload = `${uid}.${Math.floor(Date.now() / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

/** Cookie options shared by every place that sets or clears the session cookie. */
export function sessionCookieOptions(maxAge = SESSION_DURATION_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

/**
 * Check a session token's signature and age. Returns null for anything
 * missing, malformed, tampered with, or expired (never throws).
 */
export function verifySessionCookie(token: string | undefined | null): { uid: string; timestamp: number } | null {
  if (!token || !process.env.SESSION_SECRET) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [uid, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (!uid || isNaN(timestamp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > SESSION_DURATION_SECONDS) return null;

  const expected = sign(`${uid}.${timestampStr}`);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return { uid, timestamp };
}

/**
 * The signed-in user's profile, or null. Use this everywhere the server needs
 * to know who is asking (Server Components, route handlers, server actions).
 *
 * A session is also rejected if it was issued before the user's
 * `sessions_valid_after` (set when their password or email changes), which
 * signs them out on every other device.
 */
export async function getServerUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  try {
    const snap = await getAdminDb().collection("users").doc(session.uid).get();
    if (!snap.exists) return null;

    const data = snap.data()!;
    const validAfter = typeof data.sessions_valid_after === "number" ? data.sessions_valid_after : 0;
    if (session.timestamp < validAfter) return null;

    return { uid: snap.id, ...serializeData(data) } as UserProfile;
  } catch (err) {
    console.error("[getServerUser] Failed to fetch profile:", err);
    return null;
  }
}

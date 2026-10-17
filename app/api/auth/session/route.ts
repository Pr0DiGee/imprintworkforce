import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getServerUser,
  sessionCookieOptions,
  signSessionCookie,
} from "@/lib/server-auth";

// ─── Token verification via Firebase REST API ─────────────────────────────────

async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set. Check your .env.local file.");
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Firebase token verification failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const uid: string | undefined = data?.users?.[0]?.localId;
  if (!uid) throw new Error("Token is valid but no user was returned by Firebase.");
  return uid;
}

// ─── POST /api/auth/session ── exchange a Firebase ID token for our cookie ────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken: string | undefined = body?.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing or invalid idToken in request body." }, { status: 400 });
    }

    const uid = await verifyFirebaseIdToken(idToken);
    const response = NextResponse.json({ uid }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, signSessionCookie(uid), sessionCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("[POST /api/auth/session]", message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// ─── GET /api/auth/session ── who is signed in (401 if nobody) ────────────────

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
  return NextResponse.json({ uid: user.uid }, { status: 200 });
}

// ─── DELETE /api/auth/session ── sign out this device ─────────────────────────

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
  return response;
}

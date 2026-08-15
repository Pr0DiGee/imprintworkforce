import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── POST /api/auth/session ────────────────────────────────────────────────────
// Called by the client after a successful Firebase sign-in.
// Accepts the short-lived Firebase ID token, verifies it server-side,
// then sets an httpOnly session cookie containing the verified UID.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken: string | undefined = body?.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid idToken" },
        { status: 400 }
      );
    }

    // Verify the ID token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const response = NextResponse.json({ uid: decodedToken.uid }, { status: 200 });

    // Set httpOnly, Secure session cookie
    response.cookies.set(SESSION_COOKIE_NAME, decodedToken.uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS / 1000, // maxAge is in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[POST /api/auth/session] Token verification failed:", error);
    return NextResponse.json(
      { error: "Unauthorized: invalid token" },
      { status: 401 }
    );
  }
}

// ─── DELETE /api/auth/session ──────────────────────────────────────────────────
// Clears the session cookie on sign-out.

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { status: 200 });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Immediately expire
    path: "/",
  });

  return response;
}

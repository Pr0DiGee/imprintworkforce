import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Signed session helpers ──────────────────────────────────────────────────
// We sign sessions with HMAC-SHA256 using a server secret instead of storing
// a raw UID. Format: "uid.timestamp.signature"

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set in .env.local. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

function signSession(uid: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${uid}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifySession(
  token: string
): { uid: string; timestamp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [uid, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (!uid || isNaN(timestamp)) return null;

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > SESSION_DURATION_SECONDS) return null;

  // Verify signature
  const payload = `${uid}.${timestampStr}`;
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  return { uid, timestamp };
}

// ─── Token verification via Firebase REST API ─────────────────────────────────

async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_API_KEY is not set. Check your .env.local file."
    );
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ??
        `Firebase token verification failed (HTTP ${res.status})`
    );
  }

  const data = await res.json();
  const uid: string | undefined = data?.users?.[0]?.localId;

  if (!uid) {
    throw new Error("Token is valid but no user was returned by Firebase.");
  }

  return uid;
}

// ─── POST /api/auth/session ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken: string | undefined = body?.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid idToken in request body." },
        { status: 400 }
      );
    }

    const uid = await verifyFirebaseIdToken(idToken);
    const sessionToken = signSession(uid);

    const response = NextResponse.json({ uid }, { status: 200 });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    console.error("[POST /api/auth/session]", message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// ─── GET /api/auth/session ─────────────────────────────────────────────────────
// Returns the current user's UID from the signed session cookie.

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const session = verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  return NextResponse.json({ uid: session.uid }, { status: 200 });
}

// ─── DELETE /api/auth/session ──────────────────────────────────────────────────

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { status: 200 });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

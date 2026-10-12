import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifySession } from "@/app/api/auth/session/route";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = verifySession(sessionCookie);
    if (!session?.uid) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, userAgent } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    const endpointHash = crypto
      .createHash("sha256")
      .update(subscription.endpoint)
      .digest("hex");

    const db = getAdminDb();
    await db.collection("push_subscriptions").doc(endpointHash).set({
      uid: session.uid,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      user_agent: userAgent || "",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: "Subscription saved." });
  } catch (error: any) {
    console.error("[POST /api/notifications/subscribe] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

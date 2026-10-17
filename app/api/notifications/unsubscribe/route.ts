import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerUser } from "@/lib/server-auth";

/**
 * Called on sign-out: stop sending this user's notifications to this device.
 * The browser keeps its push permission; whoever signs in next re-links the
 * device to themselves (NotificationPermissionBanner → /subscribe).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const id = crypto.createHash("sha256").update(endpoint).digest("hex");
    const ref = getAdminDb().collection("push_subscriptions").doc(id);
    const snap = await ref.get();

    // Only remove the link if it belongs to the person signing out
    if (snap.exists && snap.data()?.uid === user.uid) {
      await ref.delete();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/notifications/unsubscribe]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

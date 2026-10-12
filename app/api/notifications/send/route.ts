import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/app/api/auth/session/route";
import { sendPushNotification } from "@/lib/push-notifications";

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
    const { uids, title, body: messageBody, url } = body;

    if (!Array.isArray(uids) || uids.length === 0 || !title || !messageBody) {
      return NextResponse.json(
        { error: "Missing required parameters (uids, title, body)" },
        { status: 400 }
      );
    }

    const result = await sendPushNotification({
      uids,
      title,
      body: messageBody,
      url: url || "/dashboard",
    });

    return NextResponse.json({ ok: true, sent: result.success, failed: result.failed });
  } catch (error: any) {
    console.error("[POST /api/notifications/send] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

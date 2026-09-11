import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/server-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newEmail, newPassword } = await req.json();

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    if (!newEmail && !newPassword) {
      return NextResponse.json({ error: "Provide a new email or new password" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Verify the current password by trying to sign in with it via Firebase REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: currentPassword,
          returnSecureToken: false,
        }),
      }
    );

    if (!verifyRes.ok) {
      const errData = await verifyRes.json();
      const errMsg = errData?.error?.message || "";
      if (errMsg.includes("INVALID_PASSWORD") || errMsg.includes("INVALID_LOGIN_CREDENTIALS")) {
        return NextResponse.json({ error: "Incorrect current password." }, { status: 403 });
      }
      return NextResponse.json({ error: "Password verification failed." }, { status: 403 });
    }

    // Update via Admin SDK (bypasses client-side restrictions)
    const updatePayload: { email?: string; password?: string } = {};
    if (newEmail) updatePayload.email = newEmail;
    if (newPassword) updatePayload.password = newPassword;

    await auth.updateUser(user.uid, updatePayload);

    // Sync email change to Firestore
    if (newEmail) {
      await db.collection("users").doc(user.uid).update({ email: newEmail });
    }

    return NextResponse.json({ 
      success: true,
      message: newEmail ? "Email updated successfully." : "Password updated successfully.",
    });
  } catch (error: any) {
    console.error("[POST /api/auth/update-credentials]", error);

    if (error.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 400 });
    }
    if (error.code === "auth/invalid-email") {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (error.code === "auth/weak-password") {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

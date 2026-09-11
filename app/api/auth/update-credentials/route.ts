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

      // Send confirmation email to the new address
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailResult = await resend.emails.send({
          from: "Imprint Workforce <no-reply@zubby.me>",
          to: newEmail,
          subject: "Your Email Has Been Updated — Imprint Workforce",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
              <div style="text-align: center; margin-bottom: 28px;">
                <h1 style="font-size: 22px; font-weight: 700; margin: 0; color: #111;">Imprint Workforce</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                This is to confirm that your email address on the <strong>Imprint Workforce</strong> platform has been successfully updated to:
              </p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 14px 18px; text-align: center; margin: 0 0 20px;">
                <span style="font-size: 16px; font-weight: 600; color: #111;">${newEmail}</span>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Please use this email going forward to sign in. If you did not make this change, contact your administrator immediately.
              </p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0 16px;" />
              <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
                Imprint Global Church &bull; Imprint Workforce Platform
              </p>
            </div>
          `,
        });

        if (emailResult.error) {
          console.error("[update-credentials] Resend API error:", JSON.stringify(emailResult.error));
        } else {
          console.log("[update-credentials] Confirmation email sent:", emailResult.data?.id);
        }
      } catch (emailErr) {
        // Don't fail the request if the notification email fails
        console.error("[update-credentials] Failed to send confirmation email:", emailErr);
      }
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

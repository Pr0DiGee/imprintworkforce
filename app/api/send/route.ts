import { Resend } from "resend";
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/server-auth";
import { isPastor } from "@/lib/roles";
import { DEPARTMENTS, type Department } from "@/types";

// The only addresses reports can be forwarded to. Values come from env vars
// (set in .env.local locally and in Vercel → Environment Variables for live).
const RECIPIENTS = {
  CHURCH: { env: "CHURCH_EMAIL", label: "Church Email" },
  LEAD_PASTOR: { env: "LEAD_PASTOR_EMAIL", label: "Lead Pastor" },
} as const;

type RecipientKey = keyof typeof RECIPIENTS;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Forwards a department report to a fixed church recipient.
export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to, department, targetSunday, headerPrefix, reportTitle, reportHtml } =
      await request.json();

    if (!(to in RECIPIENTS)) {
      return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
    }
    if (!DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }
    if (typeof targetSunday !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(targetSunday)) {
      return NextResponse.json({ error: "Invalid report date" }, { status: 400 });
    }
    if (typeof reportHtml !== "string" || !reportHtml.trim()) {
      return NextResponse.json({ error: "Report is empty" }, { status: 400 });
    }

    // Only pastors or members of the report's department may forward it
    const userDepts = user.departments ?? [];
    if (!isPastor(user.role) && !userDepts.includes(department as Department)) {
      return NextResponse.json({ error: "You cannot forward this department's report" }, { status: 403 });
    }

    const recipient = RECIPIENTS[to as RecipientKey];
    const recipientEmail = process.env[recipient.env];
    if (!recipientEmail) {
      return NextResponse.json(
        { error: `${recipient.label} address is not configured on the server` },
        { status: 500 }
      );
    }

    const prefix = escapeHtml(String(headerPrefix ?? ""));
    const title = escapeHtml(String(reportTitle ?? ""));
    const deptName = department.replace(/_/g, " ");
    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <h1 style="text-align: center; color: #111827;">${prefix} Report</h1>
        <h2 style="text-align: center; color: #374151; margin-top: 4px;">${title}</h2>
        <p style="text-align: center; color: #6b7280; font-style: italic;">Date: ${dateStr}</p>
        <hr style="border: none; height: 2px; background-color: #b91c1c; margin: 2rem 0;" />
        <div style="margin-top: 20px;">
          ${reportHtml}
        </div>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0 16px;" />
        <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
          Forwarded by ${escapeHtml(user.name)} via Imprint Workforce
        </p>
      </div>
    `;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const resendResponse = await resend.emails.send({
      from: "Imprint Workforce <no-reply@zubby.me>",
      to: recipientEmail,
      replyTo: user.email || undefined,
      subject: `Weekly Report - ${deptName} - ${targetSunday}`,
      html,
    });

    if (resendResponse.error) {
      console.error("[POST /api/send] Resend API error:", resendResponse.error);
      return NextResponse.json({ error: "Email service rejected the message" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/send]", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

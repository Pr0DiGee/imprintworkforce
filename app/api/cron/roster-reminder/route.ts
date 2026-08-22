import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import { getTargetSundayString, formatTargetSunday } from "@/lib/sunday";
import { ROSTER_DUTY_LABELS, Roster } from "@/types";

export async function GET(request: Request) {
  // Very basic security: check for a cron secret header or query param.
  // In production with Vercel Cron, you check the bearer token or IP.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const db = getAdminDb();
    const targetSunday = getTargetSundayString();
    
    // Fetch all roster assignments for upcoming Sunday
    const rosterSnap = await db
      .collection("roster")
      .where("service_date", "==", targetSunday)
      .get();
      
    if (rosterSnap.empty) {
      return NextResponse.json({ success: true, message: "No roster duties assigned for upcoming Sunday." });
    }

    const assignments = rosterSnap.docs.map(doc => doc.data() as Roster);
    
    // Fetch all users to map uid to email and name
    const usersSnap = await db.collection("users").get();
    const userMap: Record<string, { email: string; name: string }> = {};
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        userMap[doc.id] = { email: data.email, name: data.name };
      }
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailsSent = [];

    // Send emails
    for (const assignment of assignments) {
      const user = userMap[assignment.assigned_to];
      if (!user) continue;

      const dutyLabel = ROSTER_DUTY_LABELS[assignment.duty] || assignment.duty;
      const dateLabel = formatTargetSunday(targetSunday);
      
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Imprint Workforce: Roster Reminder</h2>
          <p>Hello ${user.name},</p>
          <p>This is a reminder that you are scheduled for <strong>${dutyLabel}</strong> for the upcoming service on <strong>${dateLabel}</strong>.</p>
          <p>Please log in to the dashboard if you need more details.</p>
          <br/>
          <p>Blessings,<br/>The Imprint Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Imprint Workforce <onboarding@resend.dev>", 
          to: user.email,
          subject: `Reminder: You are assigned for ${dutyLabel} on ${dateLabel}`,
          html,
        });
        emailsSent.push(user.email);
      } catch (err) {
        console.error("Failed to send email to", user.email, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: emailsSent.length, 
      sentTo: emailsSent 
    });

  } catch (error) {
    console.error("Cron Error (Roster):", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

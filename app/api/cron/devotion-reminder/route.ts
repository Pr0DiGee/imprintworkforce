import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import { DevotionDaily } from "@/types";

function getISODateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const db = getAdminDb();
    
    // Remind for today and tomorrow
    const today = getISODateOffset(0);
    const tomorrow = getISODateOffset(1);
    const dates = [today, tomorrow];

    const devotionSnap = await db
      .collection("devotion")
      .where("date", "in", dates)
      .get();
      
    if (devotionSnap.empty) {
      return NextResponse.json({ success: true, message: "No devotions found for today or tomorrow." });
    }

    const devotions = devotionSnap.docs.map(doc => doc.data() as DevotionDaily);
    
    // Fetch all users
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

    for (const devotion of devotions) {
      if (!devotion.assigned_to) continue;
      
      const user = userMap[devotion.assigned_to];
      if (!user) continue;

      const isToday = devotion.date === today;
      const dayLabel = isToday ? "Today" : "Tomorrow";
      const topicStr = devotion.topic ? `Topic: ${devotion.topic}` : "Topic: (Not set yet)";

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Imprint Workforce: Devotion Reminder</h2>
          <p>Hello ${user.name},</p>
          <p>This is a reminder that you are scheduled to lead the Daily Devotion <strong>${dayLabel} (${devotion.date})</strong>.</p>
          <p><strong>${topicStr}</strong></p>
          ${!devotion.teaching_notes ? '<p style="color: #d97706;">Friendly reminder: Please add your teaching notes in the dashboard.</p>' : ''}
          <br/>
          <p>Blessings,<br/>The Imprint Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Imprint Workforce <onboarding@resend.dev>", 
          to: user.email,
          subject: `Reminder: You are leading devotion ${dayLabel}`,
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
    console.error("Cron Error (Devotion):", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { Resend } from "resend";
import { NextResponse } from "next/server";

// To make this route handle POST requests
export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const data = await resend.emails.send({
      from: "Church OS <onboarding@resend.dev>", // replace with your verified domain
      to,
      subject,
      html,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}

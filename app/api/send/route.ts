import { Resend } from "resend";
import { NextResponse } from "next/server";

// To make this route handle POST requests
export async function POST(request: Request) {
  try {
    const { to, subject, html, attachment } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const attachments = [];
    if (attachment && attachment.content && attachment.filename) {
      attachments.push({
        filename: attachment.filename,
        content: attachment.content.split("base64,")[1] || attachment.content,
      });
    }

    const resendResponse = await resend.emails.send({
      from: "Church OS <onboarding@resend.dev>", // replace with your verified domain
      to,
      subject,
      html,
      attachments,
    });

    if (resendResponse.error) {
      console.error("Resend API Error:", resendResponse.error);
      return NextResponse.json({ error: resendResponse.error }, { status: 400 });
    }

    return NextResponse.json(resendResponse.data);
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerUser } from "@/lib/server-auth";
import { PrintButton } from "./PrintButton";
import QRCode from "react-qr-code";

export default async function AttendanceQRPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  
  if (user.role !== "PASTOR" && user.role !== "LEAD_PASTOR") {
    redirect("/dashboard");
  }

  // Determine host dynamically from request headers
  const headersList = await headers();
  const host = headersList.get("host") || "imprint.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const checkinUrl = `${protocol}://${host}/checkin`;
  const displayUrl = `${host}/checkin`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-12 text-center pb-20">
      <div className="no-print mb-8">
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Print Check-In QR Code
        </h2>
        <p className="text-sm mt-2 mb-6" style={{ color: "var(--text-secondary)" }}>
          Print this page and place it at the entrance for members to check in.
        </p>
        <PrintButton />
      </div>

      <div className="border rounded-2xl p-12 inline-block shadow-sm" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-center" style={{ color: "var(--text-primary)" }}>
          Welcome to Imprint
        </h1>
        <p className="text-lg text-center mb-10" style={{ color: "var(--text-secondary)" }}>
          Scan this code to check in for today's service
        </p>
        
        <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-8 shadow-md border" style={{ borderColor: "var(--border-primary)" }}>
          <QRCode 
            value={checkinUrl}
            size={400}
            style={{ height: "auto", maxWidth: "400px", width: "100%" }}
            viewBox={`0 0 400 400`}
          />
        </div>

        <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
          Having trouble? Go to <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{displayUrl}</span> in your browser.
        </p>
      </div>
    </div>
  );
}

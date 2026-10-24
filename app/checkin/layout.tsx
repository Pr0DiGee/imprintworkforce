import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Check In | Imprint Workforce",
  description: "Check in for today's service.",
};

export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col pt-8 pb-6 px-4 sm:pt-16" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <div className="flex flex-col items-center mb-8 text-center">
          <Logo size={72} className="w-[72px] h-[72px] mb-4" priority />
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-[var(--text-primary)]">
            Welcome to Imprint Church
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Please check in for today&apos;s service.
          </p>
        </div>
        
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

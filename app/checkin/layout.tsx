import type { Metadata } from "next";

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
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4" 
            style={{ background: "var(--accent)" }}
          >
            <span className="text-2xl text-white font-bold tracking-tight">I<span className="opacity-80">W</span></span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-[var(--text-primary)]">
            Welcome to Imprint
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Please check in for today's service.
          </p>
        </div>
        
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

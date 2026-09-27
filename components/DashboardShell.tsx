"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarUserInfo } from "@/components/SidebarUserInfo";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, FileText, UserCheck } from "lucide-react";

function MobileNavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  
  return (
    <Link 
      href={href}
      className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${active ? "" : "hover:opacity-80"}`}
      style={{ color: active ? "var(--accent-text)" : "var(--text-muted)" }}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} className="mb-1" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-56 flex-col shrink-0 fixed inset-y-0 left-0 z-30"
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-primary)",
        }}
      >
        <div className="px-4 py-5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <img src="/logo.png" alt="Imprint Global Church" className="w-8 h-8 object-contain" />
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
            Imprint
            <br />
            <span style={{ color: "var(--accent)" }}>Workforce</span>
          </h1>
        </div>

        <SidebarNav />

        <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <SidebarUserInfo />
          <SignOutButton />
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 no-print"
        style={{
          background: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Imprint Global Church" className="w-6 h-6 object-contain" />
          <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Imprint Workforce
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Mobile slide-over ───────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${mobileOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={() => setMobileOpen(false)}
      />
      {/* Panel */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-primary)",
        }}
      >
        <div className="px-4 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Imprint Global Church" className="w-8 h-8 object-contain" />
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
              Imprint
              <br />
              <span style={{ color: "var(--accent)" }}>Workforce</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <SidebarNav onNavigate={() => setMobileOpen(false)} />

        <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <SidebarUserInfo />
          <SignOutButton />
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-56 mt-14 md:mt-0 mb-16 md:mb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around pb-safe pt-2 px-2"
        style={{
          background: "var(--bg-sidebar)",
          borderTop: "1px solid var(--border-primary)",
        }}
      >
        <MobileNavItem href="/dashboard" icon={LayoutDashboard} label="Home" />
        <MobileNavItem href="/dashboard/tasks" icon={CheckSquare} label="Tasks" />
        <MobileNavItem href="/dashboard/reports" icon={FileText} label="Reports" />
        <MobileNavItem href="/dashboard/followup" icon={UserCheck} label="Follow-Up" />
      </nav>
    </div>
  );
}

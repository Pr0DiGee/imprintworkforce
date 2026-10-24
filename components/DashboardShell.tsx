"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarUserInfo } from "@/components/SidebarUserInfo";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, FileText, UserCheck } from "lucide-react";

import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import type { UserProfile } from "@/types";
import type { SidebarDots } from "@/lib/action-items";
import { NavDot } from "@/components/NavDot";
import { Logo } from "@/components/Logo";

function MobileNavItem({ href, icon: Icon, label, dot = false }: { href: string; icon: any; label: string; dot?: boolean }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  
  return (
    <Link 
      href={href}
      className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${active ? "" : "hover:opacity-80"}`}
      style={{ color: active ? "var(--accent-text)" : "var(--text-muted)" }}
    >
      <span className="relative mb-1">
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        <NavDot show={dot} className="absolute -top-0.5 -right-1" />
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export function DashboardShell({ children, user, dots }: { children: React.ReactNode; user: UserProfile; dots: SidebarDots }) {
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
          <Logo size={32} className="w-8 h-8" priority />
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
            Imprint
            <br />
            <span style={{ color: "var(--accent)" }}>Workforce</span>
          </h1>
        </div>

        <SidebarNav user={user} dots={dots} />

        <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <SidebarUserInfo user={user} needsPhone={dots.profile} />
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
          <Logo size={24} className="w-6 h-6" priority />
          <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Imprint Workforce
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md relative"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <NavDot show={Object.values(dots).some(Boolean)} className="absolute top-1 right-1" />
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
            <Logo size={32} className="w-8 h-8" priority />
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

        <SidebarNav user={user} dots={dots} onNavigate={() => setMobileOpen(false)} />

        <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <SidebarUserInfo user={user} needsPhone={dots.profile} />
          <SignOutButton />
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-56 mt-14 md:mt-0 mb-16 md:mb-0">
        <NotificationPermissionBanner />
        {children}
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around pb-[env(safe-area-inset-bottom)] pt-2 px-2 no-print"
        style={{
          background: "var(--bg-sidebar)",
          borderTop: "1px solid var(--border-primary)",
        }}
      >
        <MobileNavItem href="/dashboard" icon={LayoutDashboard} label="Home" />
        <MobileNavItem href="/dashboard/tasks" icon={CheckSquare} label="Tasks" dot={dots.tasks} />
        <MobileNavItem href="/dashboard/reports" icon={FileText} label="Reports" dot={dots.reports} />
        <MobileNavItem href="/dashboard/followup" icon={UserCheck} label="Follow-Up" dot={dots.followup} />
      </nav>
    </div>
  );
}

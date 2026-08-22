"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarUserInfo } from "@/components/SidebarUserInfo";
import { SignOutButton } from "@/components/SignOutButton";

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
        <div className="px-4 py-5" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
            Church Resource
            <br />
            <span style={{ color: "var(--accent)" }}>Planning</span>
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
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          CRP
        </h1>
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
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <aside
            className="md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col"
            style={{
              background: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-primary)",
            }}
          >
            <div className="px-4 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                Church Resource
                <br />
                <span style={{ color: "var(--accent)" }}>Planning</span>
              </h1>
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
        </>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-56 mt-14 md:mt-0">
        {children}
      </main>
    </div>
  );
}

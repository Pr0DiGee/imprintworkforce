"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  ClipboardList,
  BookOpen,
  MessageSquare,
  StickyNote,
  UserCheck,
  Settings,
  Sun,
  Moon,
  MapPin
} from "lucide-react";
import React from "react";

const CORE_LINKS = [
  { href: "/dashboard", id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/reports", id: "nav-reports", label: "Reports", icon: FileText },
  { href: "/dashboard/tasks", id: "nav-tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/roster", id: "nav-roster", label: "Roster", icon: ClipboardList },
  { href: "/dashboard/devotion", id: "nav-devotion", label: "Devotion", icon: BookOpen },
  { href: "/dashboard/feedback", id: "nav-feedback", label: "Feedback", icon: MessageSquare },
  { href: "/dashboard/evangelism", id: "nav-evangelism", label: "Evangelism", icon: MapPin },
  { href: "/dashboard/followup", id: "nav-followup", label: "Follow-Up", icon: UserCheck },
  { href: "/dashboard/notes", id: "nav-notes", label: "Notes", icon: StickyNote },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const isLeadPastor = userProfile?.role === "LEAD_PASTOR";
  const isPastorPlus = ["PASTOR", "LEAD_PASTOR"].includes(userProfile?.role ?? "");

  const linkClasses = (href: string) => {
    const active = isActive(pathname, href);
    return [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
      active
        ? "font-semibold"
        : "hover:opacity-80",
    ].join(" ");
  };

  const linkStyle = (href: string) => {
    const active = isActive(pathname, href);
    return {
      background: active ? "var(--accent-subtle)" : "transparent",
      color: active ? "var(--accent-text)" : "var(--text-secondary)",
      borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
    };
  };

  return (
    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
      {CORE_LINKS.map(({ href, id, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          id={id}
          className={linkClasses(href)}
          style={linkStyle(href)}
          onClick={onNavigate}
        >
          <Icon size={18} className="shrink-0" />
          {label}
        </Link>
      ))}

      {/* PASTOR+ sub-links */}
      {isPastorPlus && (
        <div className="pl-8 space-y-0.5 mt-1 mb-2">
          <Link
            href="/dashboard/attendance"
            id="nav-attendance"
            className={`${linkClasses("/dashboard/attendance")} text-xs py-1.5`}
            style={linkStyle("/dashboard/attendance")}
            onClick={onNavigate}
          >
            Attendance
          </Link>
          <Link
            href="/dashboard/reports/all"
            id="nav-all-reports"
            className={`${linkClasses("/dashboard/reports/all")} text-xs py-1.5`}
            style={linkStyle("/dashboard/reports/all")}
            onClick={onNavigate}
          >
            All Reports
          </Link>
          <Link
            href="/dashboard/reports/history"
            id="nav-history"
            className={`${linkClasses("/dashboard/reports/history")} text-xs py-1.5`}
            style={linkStyle("/dashboard/reports/history")}
            onClick={onNavigate}
          >
            History
          </Link>
        </div>
      )}

      {/* LEAD_PASTOR admin */}
      {isLeadPastor && (
        <>
          <div className="my-3" style={{ borderTop: "1px solid var(--border-primary)" }} />
          <Link
            href="/dashboard/admin"
            id="nav-admin"
            className={linkClasses("/dashboard/admin")}
            style={{
              ...linkStyle("/dashboard/admin"),
              color: isActive(pathname, "/dashboard/admin") ? "var(--accent-text)" : "#a78bfa",
            }}
            onClick={onNavigate}
          >
            <Settings size={18} className="shrink-0" />
            User Management
          </Link>
        </>
      )}

      {/* Theme toggle */}
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          {theme === "dark" ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );
}

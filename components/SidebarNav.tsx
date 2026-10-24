"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  HeartHandshake,
  Bell,
  Sun,
  Moon,
  MapPin
} from "lucide-react";
import React from "react";
import { can } from "@/lib/permissions";
import type { UserProfile } from "@/types";
import type { SidebarDots } from "@/lib/action-items";
import { NavDot } from "@/components/NavDot";

const CORE_LINKS = [
  { href: "/dashboard", id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/reports", id: "nav-reports", label: "Reports", icon: FileText },
  { href: "/dashboard/tasks", id: "nav-tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/roster", id: "nav-roster", label: "Roster", icon: ClipboardList },
  { href: "/dashboard/devotion", id: "nav-devotion", label: "Devotion", icon: BookOpen },
  { href: "/dashboard/feedback", id: "nav-feedback", label: "Feedback", icon: MessageSquare },
  { href: "/dashboard/followup", id: "nav-followup", label: "Follow-Up", icon: UserCheck },
  { href: "/dashboard/notes", id: "nav-notes", label: "Notes", icon: StickyNote },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

/** Which sidebar links show a "needs attention" dot */
const DOT_FOR_HREF: Record<string, keyof SidebarDots> = {
  "/dashboard/tasks": "tasks",
  "/dashboard/reports": "reports",
  "/dashboard/feedback": "feedback",
  "/dashboard/followup": "followup",
};

export function SidebarNav({ user, dots, onNavigate }: { user: UserProfile; dots: SidebarDots; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const isAdmin = can(user, "manageUsers");
  const isPastorPlus = can(user, "viewAllReports");
  const showAttendance = can(user, "manageAttendance");

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
          aria-current={isActive(pathname, href) ? "page" : undefined}
        >
          <Icon size={18} className="shrink-0" />
          <span className="flex-1">{label}</span>
          <NavDot show={Boolean(DOT_FOR_HREF[href] && dots[DOT_FOR_HREF[href]])} />
        </Link>
      ))}

      {/* Attendance (pastors + ushers) and PASTOR+ sub-links */}
      {(showAttendance || isPastorPlus) && (
        <div className="pl-8 space-y-0.5 mt-1 mb-2">
          {showAttendance && (
          <Link
            href="/dashboard/attendance"
            id="nav-attendance"
            className={`${linkClasses("/dashboard/attendance")} text-xs py-1.5`}
            style={linkStyle("/dashboard/attendance")}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/attendance") ? "page" : undefined}
          >
            Attendance
          </Link>
          )}
          {isPastorPlus && (
          <>
          <Link
            href="/dashboard/reports/all"
            id="nav-all-reports"
            className={`${linkClasses("/dashboard/reports/all")} text-xs py-1.5`}
            style={linkStyle("/dashboard/reports/all")}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/reports/all") ? "page" : undefined}
          >
            All Reports
          </Link>
          <Link
            href="/dashboard/reports/history"
            id="nav-history"
            className={`${linkClasses("/dashboard/reports/history")} text-xs py-1.5`}
            style={linkStyle("/dashboard/reports/history")}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/reports/history") ? "page" : undefined}
          >
            History
          </Link>
          </>
          )}
        </div>
      )}

      {/* ADMIN ONLY */}
      {isAdmin && (
        <>
          <div className="my-3" style={{ borderTop: "1px solid var(--border-primary)" }} />
          <Link
            href="/dashboard/checkups"
            id="nav-checkups"
            className={linkClasses("/dashboard/checkups")}
            style={linkStyle("/dashboard/checkups")}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/checkups") ? "page" : undefined}
          >
            <HeartHandshake size={18} className="shrink-0" />
            Workers Check-In
          </Link>
          <Link
            href="/dashboard/notifications"
            id="nav-notifications"
            className={linkClasses("/dashboard/notifications")}
            style={linkStyle("/dashboard/notifications")}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/notifications") ? "page" : undefined}
          >
            <Bell size={18} className="shrink-0" />
            Notifications
          </Link>
          <Link
            href="/dashboard/admin"
            id="nav-admin"
            className={linkClasses("/dashboard/admin")}
            style={{
              ...linkStyle("/dashboard/admin"),
              color: isActive(pathname, "/dashboard/admin") ? "var(--accent-text)" : "#a78bfa",
            }}
            onClick={onNavigate}
            aria-current={isActive(pathname, "/dashboard/admin") ? "page" : undefined}
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

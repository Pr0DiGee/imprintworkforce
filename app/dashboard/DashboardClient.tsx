"use client";

import Link from "next/link";
import type { UserProfile, Roster, DevotionDaily } from "@/types";
import { ROSTER_DUTIES, ROSTER_DUTY_LABELS } from "@/types";
import { Avatar } from "@/components/Avatar";
import { getShortDayLabel, formatShortDate } from "@/lib/date";
import { isPastor, isLeadPastor } from "@/lib/roles";
import type { DashboardStats } from "@/lib/server-data";
import {
  FileText,
  Globe,
  CheckSquare,
  MessageSquare,
} from "lucide-react";

// ─── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  href: string;
  accentColor: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, href, accentColor, icon }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl p-4 transition-all hover:scale-[1.02]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: accentColor }}>
            {value}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        </div>
        <span className="opacity-60" style={{ color: accentColor }}>
          {icon}
        </span>
      </div>
    </Link>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  user: UserProfile;
  stats: DashboardStats;
  roster: Record<string, Roster>;
  devotions: Record<string, DevotionDaily>;
  users: Record<string, string>;
  currentSunday: string;
  upcomingSunday: string;
  weekDays: string[];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DashboardClient({
  user,
  stats,
  roster,
  devotions,
  users,
  currentSunday,
  upcomingSunday,
  weekDays,
}: DashboardClientProps) {
  const upSundayFormatted = formatShortDate(upcomingSunday);

  const devAssignedCount = weekDays.filter(
    (date) => devotions[date]?.assigned_to && devotions[date]?.topic
  ).length;

  return (
    <div className="max-w-4xl space-y-6 print-full-width">
      {/* Welcome card */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={user.name} uid={user.uid} size="lg" />
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Welcome back, {user.name}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {user.role.replace(/_/g, " ")}
              {user.departments?.length
                ? ` · ${user.departments.map((d) => d.replace(/_/g, " ")).join(", ")}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title={isPastor(user.role) ? "Reports" : "My Dept Report"}
          value={
            isPastor(user.role)
              ? `${stats.reportsSubmitted}/${stats.reportTotal}`
              : stats.reportsSubmitted === 1
                ? "Ready"
                : "Pending"
          }
          subtitle={
            isPastor(user.role) ? "departments submitted" : "for this week"
          }
          href="/dashboard/reports"
          accentColor={
            stats.reportsSubmitted === stats.reportTotal
              ? "var(--success)"
              : "var(--accent)"
          }
          icon={<FileText size={24} />}
        />

        {isLeadPastor(user.role) && (
          <StatCard
            title="Global Tasks"
            value={String(stats.globalTasks)}
            subtitle="active across church"
            href="/dashboard/tasks"
            accentColor="var(--accent)"
            icon={<Globe size={24} />}
          />
        )}

        <StatCard
          title={isPastor(user.role) ? "Assigned Tasks" : "My Tasks"}
          value={String(stats.activeTasks)}
          subtitle={
            stats.overdueTasks > 0
              ? `${stats.overdueTasks} overdue`
              : isPastor(user.role)
                ? "active tasks you assigned"
                : "active tasks"
          }
          href="/dashboard/tasks"
          accentColor={
            stats.overdueTasks > 0 ? "var(--danger)" : "var(--accent)"
          }
          icon={<CheckSquare size={24} />}
        />

        <StatCard
          title="Feedback"
          value={String(stats.feedbackCount)}
          subtitle="submissions this week"
          href="/dashboard/feedback"
          accentColor="var(--accent)"
          icon={<MessageSquare size={24} />}
        />
      </div>

      {/* Widgets row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Upcoming Roster Widget */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius)",
            padding: "16px",
          }}
        >
          <div
            className="flex justify-between items-center mb-4 pb-2 border-b"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <div>
              <h3
                className="font-semibold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                Upcoming Sunday: {upSundayFormatted}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Service Roster
              </p>
            </div>
            <Link
              href="/dashboard/roster"
              className="btn icon text-xs py-1 px-2"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {ROSTER_DUTIES.map((duty) => {
              const assignedTo = roster[duty]?.assigned_to;
              const name = assignedTo
                ? users[assignedTo] || assignedTo
                : null;
              return (
                <div
                  key={duty}
                  className="flex justify-between items-center text-sm"
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {ROSTER_DUTY_LABELS[duty]}
                  </span>
                  {name ? (
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {name}
                    </span>
                  ) : (
                    <span
                      className="italic"
                      style={{ color: "var(--danger)" }}
                    >
                      Unassigned
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Devotion Widget */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius)",
            padding: "16px",
          }}
        >
          <div
            className="flex justify-between items-center mb-4 pb-2 border-b"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <div>
              <h3
                className="font-semibold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                This Week's Devotion
              </h3>
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {devAssignedCount} / 6 days ready
              </p>
            </div>
            <Link
              href="/dashboard/devotion"
              className="btn icon text-xs py-1 px-2"
            >
              Manage
            </Link>
          </div>

          <div className="space-y-3">
            {weekDays.map((date) => {
              const { dow } = getShortDayLabel(date);
              const dev = devotions[date];
              const isReady = dev?.assigned_to && dev?.topic;
              const name = dev?.assigned_to
                ? users[dev.assigned_to] || "Leader"
                : null;

              return (
                <div
                  key={date}
                  className="flex justify-between items-start gap-2 text-sm"
                >
                  <div className="flex gap-2">
                    <span
                      className="font-medium w-8"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {dow}
                    </span>
                    <span
                      className="truncate max-w-[150px] sm:max-w-[200px]"
                      style={{
                        color: isReady
                          ? "var(--text-secondary)"
                          : "var(--danger)",
                      }}
                    >
                      {isReady ? dev.topic : "Not planned"}
                    </span>
                  </div>
                  {name && (
                    <span
                      className="text-xs truncate shrink-0 max-w-[80px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

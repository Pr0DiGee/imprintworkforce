"use client";

import { useState } from "react";
import { CongregationMember, AttendanceRecord } from "@/types";
import { formatTargetSunday } from "@/lib/sunday";
import Link from "next/link";
import { Users, Search, QrCode, Filter } from "lucide-react";

interface AttendanceClientProps {
  members: CongregationMember[];
  todayAttendance: AttendanceRecord[];
  currentSunday: string;
}

export function AttendanceClient({ members, todayAttendance, currentSunday }: AttendanceClientProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "FIRST_TIMER" | "SECOND_TIMER" | "REGULAR">("ALL");

  const checkedInIds = new Set(todayAttendance.map(a => a.member_id));

  const getVisitorStatus = (member: CongregationMember): "FIRST_TIMER" | "SECOND_TIMER" | "REGULAR" => {
    if (member.attendance_count !== undefined) {
      if (member.attendance_count <= 1) return "FIRST_TIMER";
      if (member.attendance_count === 2) return "SECOND_TIMER";
      return "REGULAR";
    }
    // Fallback logic for legacy members without attendance_count
    if (!member.created_at) return "REGULAR";
    const createdAt = new Date(member.created_at as unknown as string);
    const now = new Date();
    const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24);
    if (diffDays <= 7) return "FIRST_TIMER";
    if (diffDays <= 14) return "SECOND_TIMER";
    return "REGULAR";
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
    if (!matchesSearch) return false;
    
    if (filter === "ALL") return true;
    return getVisitorStatus(m) === filter;
  }).sort((a, b) => {
    // Sort checked in first, then by name
    const aChecked = checkedInIds.has(a.id!);
    const bChecked = checkedInIds.has(b.id!);
    if (aChecked && !bChecked) return -1;
    if (!aChecked && bChecked) return 1;
    return a.name.localeCompare(b.name);
  });

  const checkedInCount = todayAttendance.length;
  const newCount = todayAttendance.filter(a => {
    const m = members.find(m => m.id === a.member_id);
    return m ? getVisitorStatus(m) === "FIRST_TIMER" : false;
  }).length;
  const returningCount = checkedInCount - newCount;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Attendance & Connect
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Overview for {formatTargetSunday(currentSunday)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/attendance/qr"
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:opacity-80 flex items-center gap-2"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          >
            <QrCode size={16} /> Print QR Code
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
          <div className="flex items-center gap-3 mb-2 text-[var(--text-secondary)]">
            <Users size={18} />
            <span className="text-sm font-semibold">Total Checked In</span>
          </div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{checkedInCount}</div>
        </div>
        <div className="p-4 rounded-xl shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
          <div className="text-sm font-semibold mb-2 text-[var(--text-secondary)]">First-time Visitors</div>
          <div className="text-3xl font-bold text-[var(--success)]">{newCount}</div>
        </div>
        <div className="p-4 rounded-xl shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
          <div className="text-sm font-semibold mb-2 text-[var(--text-secondary)]">Returning Members</div>
          <div className="text-3xl font-bold text-[var(--accent)]">{returningCount}</div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <Search size={18} className="text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm w-full"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[var(--text-muted)]" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              className="text-sm bg-transparent border-none focus:outline-none cursor-pointer font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="ALL">All Members</option>
              <option value="FIRST_TIMER">First Timers (1st visit)</option>
              <option value="SECOND_TIMER">Second Timers (2nd visit)</option>
              <option value="REGULAR">Regulars (3+ visits)</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Name</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Phone</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Visitor Status</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredMembers.map((member) => {
                const checkedIn = checkedInIds.has(member.id!);
                const status = getVisitorStatus(member);

                return (
                  <tr key={member.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</div>
                      {member.email && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{member.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {member.phone}
                    </td>
                    <td className="px-4 py-3">
                      {status === "FIRST_TIMER" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--success-subtle)", color: "var(--success)" }}>
                          1st Time Visitor
                        </span>
                      )}
                      {status === "SECOND_TIMER" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                          2nd Time Visitor
                        </span>
                      )}
                      {status === "REGULAR" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                          Regular
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {checkedIn ? (
                        <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}>
                          Checked In
                        </span>
                      ) : (
                        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                          Not here
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

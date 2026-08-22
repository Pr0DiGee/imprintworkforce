"use client";

import { useState } from "react";
import { CongregationMember, AttendanceRecord } from "@/types";
import { formatTargetSunday } from "@/lib/sunday";
import Link from "next/link";
import { Users, Search, QrCode } from "lucide-react";

interface AttendanceClientProps {
  members: CongregationMember[];
  todayAttendance: AttendanceRecord[];
  currentSunday: string;
}

export function AttendanceClient({ members, todayAttendance, currentSunday }: AttendanceClientProps) {
  const [search, setSearch] = useState("");

  const checkedInIds = new Set(todayAttendance.map(a => a.member_id));

  // Determine if a member is new (created within the last 7 days)
  const isNew = (member: CongregationMember) => {
    if (!member.created_at) return false;
    const createdAt = new Date(member.created_at as unknown as string);
    const now = new Date();
    const diff = now.getTime() - createdAt.getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.phone.includes(search)
  ).sort((a, b) => {
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
    return m ? isNew(m) : false;
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
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
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
                const isNewVisitor = isNew(member);

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
                      {isNewVisitor ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--success-subtle)", color: "var(--success)" }}>
                          New Visitor
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                          Returning
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

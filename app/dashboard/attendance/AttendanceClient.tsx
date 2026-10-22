"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CongregationMember } from "@/types";
import { formatTargetSunday, addWeeksToDate, getTargetSundayString } from "@/lib/sunday";
import Link from "next/link";
import { Users, Search, QrCode, Filter, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateMember, loadMemberPage, findMembers } from "./actions";

const fieldClass = "w-full px-3 py-2 rounded-md border text-sm";
const fieldStyle = { background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };

function EditMemberModal({ member, onClose, onSaved }: { member: CongregationMember; onClose: () => void; onSaved: (m: CongregationMember) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await updateMember(member.id!, form);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    toast.success("Member details updated");
    const field = (k: string) => String(form.get(k) ?? "").trim();
    onSaved({ ...member, name: field("name"), phone: field("phone"), email: field("email") || undefined, birthday: field("birthday") || undefined, address: field("address") || undefined });
    onClose();
    router.refresh();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit member" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl shadow-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Edit member details</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Full Name *</label>
            <input name="name" required defaultValue={member.name} className={fieldClass} style={fieldStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number *</label>
            <input name="phone" type="tel" required defaultValue={member.phone} className={fieldClass} style={fieldStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
            <input name="email" type="email" defaultValue={member.email ?? ""} className={fieldClass} style={fieldStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Birthday</label>
              <input name="birthday" type="date" defaultValue={member.birthday ?? ""} className={fieldClass} style={fieldStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Address</label>
              <input name="address" defaultValue={member.address ?? ""} className={fieldClass} style={fieldStyle} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-60" style={{ background: "var(--accent)" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AttendanceClientProps {
  /** Members who checked in on currentSunday */
  checkedIn: CongregationMember[];
  totalMembers: number;
  currentSunday: string;
}

type View = "CHECKED_IN" | "ALL";

export function AttendanceClient({ checkedIn, totalMembers, currentSunday }: AttendanceClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "FIRST_TIMER" | "SECOND_TIMER" | "REGULAR">("ALL");
  const [editing, setEditing] = useState<CongregationMember | null>(null);
  const [view, setView] = useState<View>("CHECKED_IN");

  // "All members": loaded a page at a time, only when asked for
  const [allMembers, setAllMembers] = useState<CongregationMember[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search: runs on the server across the whole congregation
  const [rawSearchResults, setSearchResults] = useState<CongregationMember[] | null>(null);
  // Results only apply while there's a search of 2+ characters
  const searchResults = search.trim().length >= 2 ? rawSearchResults : null;
  const [searching, setSearching] = useState(false);

  const checkedInIds = new Set(checkedIn.map(m => m.id));

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const last = allMembers[allMembers.length - 1];
    const res = await loadMemberPage(last ? { name: last.name, id: last.id! } : undefined);
    setLoadingMore(false);
    if ("error" in res) return toast.error(res.error);
    setAllMembers(prev => [...prev, ...res.members]);
    setHasMore(res.hasMore);
  }

  function showAll() {
    setView("ALL");
    if (allMembers.length === 0) loadMore();
  }

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await findMembers(q);
      if (!cancelled) {
        setSearchResults(results);
        setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const navigateWeek = (direction: -1 | 1) => {
    const newSunday = addWeeksToDate(currentSunday, direction);
    router.push(`/dashboard/attendance?sunday=${newSunday}`);
    router.refresh();
  };

  const isCurrentWeek = currentSunday === getTargetSundayString();

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

  const source = searchResults ?? (view === "ALL" ? allMembers : checkedIn);
  const filteredMembers = source.filter(m => filter === "ALL" || getVisitorStatus(m) === filter).sort((a, b) => {
    // Sort checked in first, then by name
    const aChecked = checkedInIds.has(a.id!);
    const bChecked = checkedInIds.has(b.id!);
    if (aChecked && !bChecked) return -1;
    if (!aChecked && bChecked) return 1;
    return a.name.localeCompare(b.name);
  });

  const checkedInCount = checkedIn.length;
  const newCount = checkedIn.filter(m => getVisitorStatus(m) === "FIRST_TIMER").length;
  const returningCount = checkedInCount - newCount;

  return (
    <div className="max-w-5xl space-y-6">
      {editing && (
        <EditMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            const patch = (list: CongregationMember[]) => list.map(x => (x.id === m.id ? m : x));
            setAllMembers(patch);
            setSearchResults(prev => (prev ? patch(prev) : prev));
          }}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Attendance & Connect
          </h2>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors border"
              style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {formatTargetSunday(currentSunday)}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              disabled={isCurrentWeek}
              className={`p-1 rounded-md transition-colors border ${isCurrentWeek ? "opacity-30 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
              style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
              placeholder={`Search all ${totalMembers} members by name or phone...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm w-full"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-1 rounded-md p-0.5" role="tablist" aria-label="Which members to show" style={{ background: "var(--bg-input)" }}>
            {([["CHECKED_IN", `Checked in (${checkedInCount})`], ["ALL", `All members (${totalMembers})`]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v && !searchResults}
                onClick={() => { setSearch(""); if (v === "ALL") { showAll(); } else { setView("CHECKED_IN"); } }}
                className="px-2.5 py-1 text-xs font-medium rounded"
                style={view === v && !searchResults ? { background: "var(--bg-card)", color: "var(--text-primary)" } : { color: "var(--text-secondary)" }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[var(--text-muted)]" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              className="text-sm bg-transparent border-none focus:outline-none cursor-pointer font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="ALL">Any visit count</option>
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
                <th className="px-2 py-3"><span className="sr-only">Edit</span></th>
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
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(member)}
                        className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: "var(--text-secondary)" }}
                        aria-label={`Edit ${member.name}`}
                        title="Edit details"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
                    {searching || loadingMore ? "Loading…" : searchResults ? "No members match that search." : view === "CHECKED_IN" ? "Nobody has checked in for this Sunday yet." : "No members found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {view === "ALL" && !searchResults && hasMore && allMembers.length > 0 && (
          <div className="p-3 text-center border-t" style={{ borderColor: "var(--border-primary)" }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              {loadingMore ? "Loading…" : `Load more (showing ${allMembers.length} of ${totalMembers})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

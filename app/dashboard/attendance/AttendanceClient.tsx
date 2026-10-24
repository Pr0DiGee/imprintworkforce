"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Search, QrCode, Filter, ChevronLeft, ChevronRight, Pencil, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { CongregationMember } from "@/types";
import type { Attendee } from "@/lib/server-data";
import { formatTargetSunday, addWeeksToDate, getTargetSundayString } from "@/lib/sunday";
import { BirthdayInput, formatBirthday } from "@/components/BirthdayInput";
import { updateMember, staffCheckInRegular, staffCheckInFirstTimer } from "./actions";

const fieldClass = "w-full px-3 py-2 rounded-md border text-sm";
const fieldStyle = { background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };
const labelClass = "block text-xs font-semibold mb-1";
const labelStyle = { color: "var(--text-secondary)" };

type VisitorStatus = "FIRST_TIMER" | "SECOND_TIMER" | "REGULAR";

/** Based on which visit that Sunday was for them, so past Sundays stay accurate. */
function visitorStatus(a: Attendee): VisitorStatus {
  if (a.visit_number <= 1) return "FIRST_TIMER";
  if (a.visit_number === 2) return "SECOND_TIMER";
  return "REGULAR";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl shadow-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, busy, label }: { onCancel: () => void; busy: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-md" style={{ color: "var(--text-secondary)" }}>Cancel</button>
      <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-60" style={{ background: "var(--accent)" }}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

function EditMemberModal({ member, onClose }: { member: CongregationMember; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await updateMember(member.id!, new FormData(e.currentTarget));
    setSaving(false);
    if ("error" in res) return setError(res.error);
    toast.success("Member details updated");
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Edit member details" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <div>
          <label className={labelClass} style={labelStyle}>Full Name *</label>
          <input name="name" required defaultValue={member.name} className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Phone Number *</label>
          <input name="phone" type="tel" required defaultValue={member.phone} className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Email</label>
          <input name="email" type="email" defaultValue={member.email ?? ""} className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Birthday (day and month)</label>
          <BirthdayInput defaultValue={member.birthday} className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Address</label>
          <input name="address" defaultValue={member.address ?? ""} className={fieldClass} style={fieldStyle} />
        </div>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <ModalActions onCancel={onClose} busy={saving} label="Save" />
      </form>
    </Modal>
  );
}

/** Usher/admin checks someone in: a first timer (name, phone, birthday) or a regular (phone only). */
function StaffCheckInModal({ sunday, onClose }: { sunday: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"FIRST_TIMER" | "REGULAR" | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function done(firstName: string, alreadyCheckedIn: boolean, existingMember?: boolean) {
    if (alreadyCheckedIn) toast.info(`${firstName} was already checked in for this Sunday`);
    else if (existingMember) toast.success(`That number belongs to ${firstName}; checked them in as a returning member`);
    else toast.success(`${firstName} is checked in`);
    onClose();
    router.refresh();
  }

  async function submitRegular(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await staffCheckInRegular(sunday, phone);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    done(res.firstName, res.alreadyCheckedIn);
  }

  async function submitFirstTimer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await staffCheckInFirstTimer(sunday, new FormData(e.currentTarget));
    setBusy(false);
    if ("error" in res) return setError(res.error);
    done(res.firstName, res.alreadyCheckedIn, res.existingMember);
  }

  const errorLine = error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>;

  return (
    <Modal title={`Check someone in · ${formatTargetSunday(sunday)}`} onClose={onClose}>
      {kind === null && (
        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Is this their first time at church?</p>
          <div className="grid grid-cols-2 gap-3">
            {([["FIRST_TIMER", "First timer", "New here: name, phone and birthday"], ["REGULAR", "Regular", "Been before: just their phone number"]] as const).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className="text-left p-3 rounded-lg border hover:opacity-90"
                style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)" }}
              >
                <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
                <span className="block text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === "REGULAR" && (
        <form onSubmit={submitRegular} className="p-5 space-y-3">
          <div>
            <label className={labelClass} style={labelStyle}>Their phone number *</label>
            <input type="tel" required autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" className={fieldClass} style={fieldStyle} />
          </div>
          {errorLine}
          {error && (
            <button type="button" onClick={() => { setKind("FIRST_TIMER"); setError(""); }} className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              Register them as a first timer instead
            </button>
          )}
          <ModalActions onCancel={onClose} busy={busy} label="Check in" />
        </form>
      )}

      {kind === "FIRST_TIMER" && (
        <form onSubmit={submitFirstTimer} className="p-5 space-y-3">
          <div>
            <label className={labelClass} style={labelStyle}>Full Name *</label>
            <input name="name" required autoFocus className={fieldClass} style={fieldStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Phone Number *</label>
            <input name="phone" type="tel" required defaultValue={phone} className={fieldClass} style={fieldStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Birthday (optional, day and month)</label>
            <BirthdayInput className={fieldClass} style={fieldStyle} />
          </div>
          {errorLine}
          <ModalActions onCancel={onClose} busy={busy} label="Check in" />
        </form>
      )}
    </Modal>
  );
}

const STATUS_BADGE: Record<VisitorStatus, { label: string; background: string; color: string }> = {
  FIRST_TIMER: { label: "1st Time Visitor", background: "var(--success-subtle)", color: "var(--success)" },
  SECOND_TIMER: { label: "2nd Time Visitor", background: "var(--accent-subtle)", color: "var(--accent)" },
  REGULAR: { label: "Regular", background: "var(--bg-input)", color: "var(--text-secondary)" },
};

export function AttendanceClient({ attendees, currentSunday }: { attendees: Attendee[]; currentSunday: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | VisitorStatus>("ALL");
  const [editing, setEditing] = useState<CongregationMember | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const isCurrentWeek = currentSunday === getTargetSundayString();
  const navigateWeek = (direction: -1 | 1) => {
    router.push(`/dashboard/attendance?sunday=${addWeeksToDate(currentSunday, direction)}`);
  };

  const q = search.trim().toLowerCase();
  const visible = attendees.filter(
    (a) =>
      (filter === "ALL" || visitorStatus(a) === filter) &&
      (!q || a.name.toLowerCase().includes(q) || a.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
  );

  const total = attendees.length;
  const firstTimers = attendees.filter((a) => visitorStatus(a) === "FIRST_TIMER").length;
  const secondTimers = attendees.filter((a) => visitorStatus(a) === "SECOND_TIMER").length;
  const regulars = total - firstTimers - secondTimers;

  return (
    <div className="max-w-5xl space-y-6 print-full-width">
      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} />}
      {checkingIn && <StaffCheckInModal sunday={currentSunday} onClose={() => setCheckingIn(false)} />}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Attendance & Connect</h2>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => navigateWeek(-1)}
              aria-label="Previous Sunday"
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors border no-print"
              style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{formatTargetSunday(currentSunday)}</span>
            <button
              onClick={() => navigateWeek(1)}
              disabled={isCurrentWeek}
              aria-label="Next Sunday"
              className={`p-1 rounded-md transition-colors border no-print ${isCurrentWeek ? "opacity-30 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
              style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 no-print">
          <button
            type="button"
            onClick={() => setCheckingIn(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-md text-white flex items-center gap-2 hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            <UserPlus size={16} /> Check someone in
          </button>
          <Link
            href="/dashboard/attendance/qr"
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:opacity-80 flex items-center gap-2"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
          >
            <QrCode size={16} /> Print QR Code
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Checked In", value: total, color: "var(--text-primary)", icon: true },
          { label: "First-time Visitors", value: firstTimers, color: "var(--success)" },
          { label: "Second-time Visitors", value: secondTimers, color: "var(--accent)" },
          { label: "Regulars", value: regulars, color: "var(--text-secondary)" },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-xl shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--text-secondary)]">
              {card.icon && <Users size={16} />}
              {card.label}
            </div>
            <div className="text-3xl font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden shadow-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <Search size={18} className="text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search this Sunday's list by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm w-full"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[var(--text-muted)]" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "ALL" | VisitorStatus)}
              aria-label="Filter by visitor type"
              className="text-sm bg-transparent border-none focus:outline-none cursor-pointer font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="ALL">Everyone</option>
              <option value="FIRST_TIMER">First Timers (1st visit)</option>
              <option value="SECOND_TIMER">Second Timers (2nd visit)</option>
              <option value="REGULAR">Regulars (3+ visits)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Name</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Phone</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Birthday</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Visitor Status</th>
                <th className="px-2 py-3 no-print"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {visible.map((member) => {
                const badge = STATUS_BADGE[visitorStatus(member)];
                return (
                  <tr key={member.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</div>
                      {member.email && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{member.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{member.phone}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{formatBirthday(member.birthday) || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: badge.background, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right no-print">
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
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
                    {total === 0 ? "Nobody has checked in for this Sunday yet." : "Nobody on this Sunday's list matches."}
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

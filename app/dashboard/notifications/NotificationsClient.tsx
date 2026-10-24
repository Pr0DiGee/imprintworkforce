"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Send, CalendarClock, Bell, RotateCcw, X } from "lucide-react";
import { AUTOMATIC_PUSH_TYPES, PUSH_TYPE_LABELS, type AutomaticPushType, type DeliveryStatus, type PushType } from "@/lib/push-types";
import type { Audience } from "@/lib/custom-pushes";
import { DEPARTMENTS, DEPARTMENT_LABELS, type Department } from "@/types";
import { setPushTypeEnabled, createCustomPush, cancelCustomPush, resendFailed } from "./actions";

export interface LogRow {
  id: string;
  type: PushType;
  title: string;
  body: string;
  recipients: string[];
  delivery: Record<string, DeliveryStatus>;
  sent_count: number;
  failed_count: number;
  no_device_count: number;
  resend_of?: string | null;
  resent_at?: string | null;
  created_at: string;
}

export interface CustomPushRow {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  send_on: string;
}

interface Person { uid: string; name: string; role: string; departments: string[] }

const card = "rounded-xl border p-5";
const cardStyle = { background: "var(--bg-card)", borderColor: "var(--border-primary)" };
const field = "w-full px-3 py-2 rounded-md border text-sm";
const fieldStyle = { background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

function describeAudience(a: Audience, names: Record<string, string>) {
  if (a.kind === "everyone") return "Everyone";
  if (a.kind === "pastors") return "All pastors";
  if (a.kind === "department") return `${DEPARTMENT_LABELS[a.department]} department`;
  return a.uids.map((u) => names[u] ?? "Former worker").join(", ");
}

function Compose({ people, today }: { people: Person[]; today: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Audience["kind"]>("everyone");
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [timing, setTiming] = useState<"now" | "date">("now");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const audience: Audience =
      kind === "department" ? { kind, department } : kind === "people" ? { kind, uids: chosen } : { kind };
    setBusy(true);
    const res = await createCustomPush({ title, body, audience, sendOn: timing === "now" ? "now" : date });
    setBusy(false);
    if ("error" in res) return toast.error(res.error);
    toast.success(res.message ?? "Done");
    setTitle("");
    setBody("");
    setChosen([]);
    router.refresh();
  }

  const shown = people.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <form onSubmit={submit} className={`${card} space-y-3`} style={cardStyle}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Send size={16} /> Send a message
      </h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Title (e.g. Workers meeting moved)" className={field} style={fieldStyle} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} required rows={3} placeholder="Message" className={field} style={fieldStyle} />

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Send to</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as Audience["kind"])} className={field} style={fieldStyle}>
          <option value="everyone">Everyone</option>
          <option value="pastors">All pastors</option>
          <option value="department">A department</option>
          <option value="people">Selected people</option>
        </select>
      </div>
      {kind === "department" && (
        <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} aria-label="Department" className={field} style={fieldStyle}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}
        </select>
      )}
      {kind === "people" && (
        <div className="rounded-md border p-2 space-y-2" style={{ borderColor: "var(--border-primary)" }}>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a person…" className={field} style={fieldStyle} />
          <div className="max-h-44 overflow-y-auto space-y-1">
            {shown.map((p) => (
              <label key={p.uid} className="flex items-center gap-2 text-sm px-1 py-0.5" style={{ color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  checked={chosen.includes(p.uid)}
                  onChange={(e) => setChosen((prev) => (e.target.checked ? [...prev, p.uid] : prev.filter((u) => u !== p.uid)))}
                />
                {p.name}
              </label>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{chosen.length} selected</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--text-primary)" }}>
        <label className="flex items-center gap-2">
          <input type="radio" checked={timing === "now"} onChange={() => setTiming("now")} /> Send now
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={timing === "date"} onChange={() => setTiming("date")} /> On a date
        </label>
        {timing === "date" && (
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Send on" className="px-2 py-1 rounded-md border text-sm" style={fieldStyle} />
        )}
      </div>
      {timing === "date" && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Scheduled messages go out between 9 and 10am Lagos time on that day.</p>
      )}

      <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-60" style={{ background: "var(--accent)" }}>
        {busy ? "Sending…" : timing === "now" ? "Send now" : "Schedule"}
      </button>
    </form>
  );
}

function Switches({ disabled }: { disabled: Partial<Record<AutomaticPushType, boolean>> }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(type: AutomaticPushType, enabled: boolean) {
    setPending(type);
    const res = await setPushTypeEnabled(type, enabled);
    setPending(null);
    if ("error" in res) return toast.error(res.error);
    toast.success(`${AUTOMATIC_PUSH_TYPES[type]}: ${enabled ? "on" : "off"}`);
    router.refresh();
  }

  return (
    <section className={`${card} space-y-2`} style={cardStyle}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Bell size={16} /> Automatic notifications
      </h3>
      {(Object.keys(AUTOMATIC_PUSH_TYPES) as AutomaticPushType[]).map((type) => {
        const on = !disabled[type];
        return (
          <label key={type} className="flex items-center justify-between gap-3 py-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
            <span>{AUTOMATIC_PUSH_TYPES[type]}</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={pending === type}
              onClick={() => toggle(type, !on)}
              className="relative w-10 h-6 rounded-full transition-colors disabled:opacity-60 shrink-0"
              style={{ background: on ? "var(--accent)" : "var(--bg-input)", border: "1px solid var(--border-primary)" }}
            >
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: on ? "1.25rem" : "0.2rem" }} />
            </button>
          </label>
        );
      })}
    </section>
  );
}

function Scheduled({ items, names }: { items: CustomPushRow[]; names: Record<string, string> }) {
  const router = useRouter();
  if (items.length === 0) return null;
  async function cancel(id: string) {
    const res = await cancelCustomPush(id);
    if ("error" in res) return toast.error(res.error);
    toast.success("Scheduled message cancelled");
    router.refresh();
  }
  return (
    <section className={`${card} space-y-3`} style={cardStyle}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <CalendarClock size={16} /> Scheduled
      </h3>
      {items.map((m) => (
        <div key={m.id} className="flex items-start justify-between gap-3 text-sm border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
          <div>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>{m.title}</p>
            <p style={{ color: "var(--text-secondary)" }}>{m.body}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {m.send_on}, 9–10am · to {describeAudience(m.audience, names)}
            </p>
          </div>
          <button type="button" onClick={() => cancel(m.id)} className="text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0" style={{ background: "var(--bg-input)", color: "var(--danger)" }}>
            <X size={12} /> Cancel
          </button>
        </div>
      ))}
    </section>
  );
}

const STATUS_STYLE: Record<DeliveryStatus, { label: string; color: string }> = {
  sent: { label: "Delivered", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--danger)" },
  no_device: { label: "Notifications not enabled", color: "var(--text-muted)" },
};

function Log({ rows, names, weeks, nextWeeks }: { rows: LogRow[]; names: Record<string, string>; weeks: number; nextWeeks: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function resend(id: string) {
    setBusy(id);
    const res = await resendFailed(id);
    setBusy(null);
    if ("error" in res) return toast.error(res.error);
    toast.success(res.message ?? "Re-sent");
    router.refresh();
  }

  return (
    <section className={`${card} space-y-3`} style={cardStyle}>
      <div>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Sent notifications</h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Last {weeks} weeks · newest first</p>
      </div>
      {rows.length === 0 && <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>Nothing sent in this period.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border-t pt-3 text-sm" style={{ borderColor: "var(--border-primary)" }}>
          <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full text-left">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{when(r.created_at)}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                {PUSH_TYPE_LABELS[r.type] ?? r.type}{r.resend_of ? " (re-send)" : ""}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {r.recipients.length} {r.recipients.length === 1 ? "person" : "people"} · <span style={{ color: "var(--success)" }}>{r.sent_count} delivered</span>
                {r.failed_count > 0 && <> · <span style={{ color: "var(--danger)" }}>{r.failed_count} failed</span></>}
                {r.no_device_count > 0 && <> · {r.no_device_count} not enabled</>}
              </span>
            </div>
            <p className="font-medium mt-1" style={{ color: "var(--text-primary)" }}>{r.title}</p>
            <p style={{ color: "var(--text-secondary)" }}>{r.body}</p>
          </button>
          {open === r.id && (
            <div className="mt-2 space-y-1 pl-2">
              {r.recipients.map((uid) => {
                const s = STATUS_STYLE[r.delivery?.[uid] ?? "no_device"];
                return (
                  <div key={uid} className="flex justify-between text-xs">
                    <span style={{ color: "var(--text-primary)" }}>{names[uid] ?? "Former worker"}</span>
                    <span style={{ color: s.color }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {r.failed_count > 0 && (
            <button
              type="button"
              onClick={() => resend(r.id)}
              disabled={busy === r.id}
              className="mt-2 text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1 disabled:opacity-60"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              <RotateCcw size={12} /> {r.resent_at ? "Re-send to failed again" : "Re-send to failed"}
            </button>
          )}
        </div>
      ))}
      <Link href={`/dashboard/notifications?weeks=${nextWeeks}`} scroll={false} className="inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>
        Show older
      </Link>
    </section>
  );
}

export function NotificationsClient({
  users,
  disabled,
  log,
  scheduled,
  weeks,
  nextWeeks,
  today,
}: {
  users: Person[];
  disabled: Partial<Record<AutomaticPushType, boolean>>;
  log: LogRow[];
  scheduled: CustomPushRow[];
  weeks: number;
  nextWeeks: number;
  today: string;
}) {
  const names = Object.fromEntries(users.map((u) => [u.uid, u.name]));
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Send messages, switch automatic notifications on or off, and see what was delivered.</p>
      </div>
      <Compose people={users} today={today} />
      <Scheduled items={scheduled} names={names} />
      <Switches disabled={disabled} />
      <Log rows={log} names={names} weeks={weeks} nextWeeks={nextWeeks} />
    </div>
  );
}

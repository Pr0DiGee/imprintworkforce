import { redirect } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { HeartHandshake } from "lucide-react";
import { getServerUser } from "@/lib/server-auth";
import { can } from "@/lib/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { fetchUserMap } from "@/lib/server-data";
import { getCurrentWeekMonday } from "@/lib/date";

export const dynamic = "force-dynamic";

/** Admin only: this week's check-up partners and who has done theirs (no history). */
export default async function WorkersCheckInPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!can(user, "viewCheckups")) redirect("/dashboard");

  const monday = getCurrentWeekMonday();
  const [snap, names] = await Promise.all([
    getAdminDb().collection("checkup_tasks").where("week", "==", monday).get(),
    fetchUserMap(),
  ]);
  const rows = snap.docs
    .map((d) => d.data())
    .map((t) => ({ checker: names[t.checker] ?? "Former worker", target: names[t.target] ?? "Former worker", done: Boolean(t.completed) }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.checker.localeCompare(b.checker));
  const doneCount = rows.filter((r) => r.done).length;
  const weekLabel = `${format(parseISO(monday), "d MMM")} – ${format(addDays(parseISO(monday), 6), "d MMM yyyy")}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Workers Check-In</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          This week ({weekLabel}){rows.length > 0 && ` · ${doneCount} of ${rows.length} done`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
          <HeartHandshake size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No pairs yet this week. Partners are drawn every Monday morning.
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Worker</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Checks up on</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{r.checker}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{r.target}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={r.done ? { background: "var(--success-subtle)", color: "var(--success)" } : { background: "var(--bg-input)", color: "var(--text-secondary)" }}
                    >
                      {r.done ? "Done" : "Not yet"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

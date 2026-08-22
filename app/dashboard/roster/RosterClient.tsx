"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  Roster,
  RosterDuty,
  ROSTER_DUTIES,
  ROSTER_DUTY_LABELS,
  UserProfile,
} from "@/types";
import { getShortDayLabel } from "@/lib/date";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/context/ToastContext";
import { Printer } from "lucide-react";

interface RosterClientProps {
  user: UserProfile;
  initialSlots: Record<string, Record<RosterDuty, Roster | null>>;
  users: UserProfile[];
  stripDates: string[];
  currentWindowSunday: string;
  canEdit: boolean;
}

export function RosterClient({
  user,
  initialSlots,
  users,
  stripDates,
  currentWindowSunday,
  canEdit: hasEditRole,
}: RosterClientProps) {
  const { success, error } = useToast();

  const [targetSunday, setTargetSunday] = useState(stripDates[1]); // Default to upcoming Sunday
  const [allSlots, setAllSlots] = useState(initialSlots);
  const [editMode, setEditMode] = useState(false);
  const [selections, setSelections] = useState<Record<RosterDuty, string>>({} as Record<RosterDuty, string>);
  const [saving, setSaving] = useState(false);

  const isPast = targetSunday < currentWindowSunday;
  const canEdit = hasEditRole && !isPast;
  const isWorker = user.role === "WORKER" && !isPast;

  useEffect(() => {
    setEditMode(false);
  }, [targetSunday]);

  const currentSlots = allSlots[targetSunday] || {};
  const assignedCount = ROSTER_DUTIES.filter((d) => currentSlots[d]?.assigned_to).length;
  
  const hasClaimedSlot = Object.values(currentSlots).some(
    (slot) => slot?.assigned_to === user.uid
  );

  function startEdit() {
    setSelections(
      Object.fromEntries(
        ROSTER_DUTIES.map((duty) => [duty, currentSlots[duty]?.assigned_to ?? ""])
      ) as Record<RosterDuty, string>
    );
    setEditMode(true);
  }

  async function handleSave() {
    if (!user || isPast) return;
    setSaving(true);

    try {
      await Promise.all(
        ROSTER_DUTIES.map((duty) => {
          const uid = selections[duty];
          if (!uid && !currentSlots[duty]) return Promise.resolve(); 
          
          return setDoc(doc(db, "roster", `${targetSunday}_${duty}`), {
            service_date: targetSunday,
            duty,
            assigned_to: uid,
            assigned_by: user.uid,
            created_at: serverTimestamp(),
          });
        })
      );

      // Refresh just this Sunday
      const slotEntries = await Promise.all(
        ROSTER_DUTIES.map(async (duty) => {
          const snap = await getDoc(doc(db, "roster", `${targetSunday}_${duty}`));
          return [duty, snap.exists() ? ({ id: snap.id, ...snap.data() } as Roster) : null] as const;
        })
      );
      
      setAllSlots(prev => ({
        ...prev,
        [targetSunday]: Object.fromEntries(slotEntries) as Record<RosterDuty, Roster | null>
      }));
      
      setEditMode(false);
      success("Roster saved successfully");
    } catch (err) {
      error("Failed to save roster.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClaim(duty: RosterDuty) {
    if (!user || isPast) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "roster", `${targetSunday}_${duty}`), {
        service_date: targetSunday,
        duty,
        assigned_to: user.uid,
        assigned_by: user.uid,
        created_at: serverTimestamp(),
      });

      const snap = await getDoc(doc(db, "roster", `${targetSunday}_${duty}`));
      
      setAllSlots(prev => {
        const updatedSunday = { ...prev[targetSunday], [duty]: { id: snap.id, ...snap.data() } as Roster };
        return { ...prev, [targetSunday]: updatedSunday };
      });
      
      success(`You have claimed ${ROSTER_DUTY_LABELS[duty]}`);
    } catch (err) {
      error("Failed to claim duty.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 print-full-width">
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Sunday Roster</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Plan and assign service duties</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:opacity-80 flex items-center gap-2 no-print"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
        >
          <Printer size={16} /> Print / PDF
        </button>
      </div>

      <div className="date-strip no-print">
        {stripDates.map((date, idx) => {
          const { dow, num } = getShortDayLabel(date);
          const monthStr = new Date(date).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
          const isSelected = date === targetSunday;
          const assigned = ROSTER_DUTIES.filter(d => allSlots[date]?.[d]?.assigned_to).length;
          const isUnplanned = assigned === 0;

          return (
            <div
              key={date}
              onClick={() => setTargetSunday(date)}
              className={`date-chip ${isSelected ? "selected" : ""} ${isUnplanned && !isSelected ? "unplanned" : ""}`}
            >
              <div className="dow">{idx === 0 ? "Past" : idx === 1 ? "This wk" : dow}</div>
              <div className="num">{num}</div>
              <div className="mon">{monthStr}</div>
            </div>
          );
        })}
      </div>

      <div className={`card ${assignedCount === 0 && !editMode ? "dim" : ""}`} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
        <div className="card-top flex justify-between items-center mb-4">
          <div className="title text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Sunday, {new Date(targetSunday).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          </div>
          
          <div className="flex items-center gap-3">
            {assignedCount === ROSTER_DUTIES.length ? (
              <span className="badge ok">{assignedCount} of {ROSTER_DUTIES.length} filled</span>
            ) : assignedCount > 0 ? (
              <span className="badge warn">{assignedCount} of {ROSTER_DUTIES.length} filled</span>
            ) : (
              <span className="badge off">Not yet planned</span>
            )}

            {canEdit && !editMode && (
              <button 
                onClick={startEdit} 
                className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-0">
          {ROSTER_DUTIES.map((duty) => {
            const roster = currentSlots[duty];
            const isUnassigned = !roster?.assigned_to;
            const assignedName = isUnassigned ? null : (users.find(u => u.uid === roster.assigned_to)?.name ?? roster.assigned_to);

            return (
              <div key={duty} className="role-row flex flex-col sm:flex-row sm:items-center justify-between py-3 border-t gap-3" style={{ borderColor: "var(--border-primary)" }}>
                <span className={`role-name text-[13.5px] flex-1 ${isUnassigned && !editMode ? "text-[var(--danger)] font-medium" : "text-[var(--text-secondary)]"}`}>
                  {isUnassigned && !editMode && "⚠ "}
                  {ROSTER_DUTY_LABELS[duty]}
                </span>
                
                {editMode ? (
                  <select
                    value={selections[duty] ?? ""}
                    onChange={(e) => setSelections(prev => ({ ...prev, [duty]: e.target.value }))}
                    className={`w-full sm:w-[220px] p-2 rounded-md border text-sm ${!selections[duty] ? "border-[var(--danger)]" : "border-[var(--border-primary)]"}`}
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                  >
                    <option value="">— unassigned —</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full sm:w-[220px] flex items-center justify-between">
                    {assignedName ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={assignedName} uid={roster?.assigned_to} size="sm" />
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{assignedName}</span>
                      </div>
                    ) : (
                      <span className="text-sm italic" style={{ color: "var(--text-muted)" }}>— unassigned —</span>
                    )}

                    {isWorker && isUnassigned && !hasClaimedSlot && !saving && (
                      <button
                        onClick={() => handleClaim(duty)}
                        className="px-2 py-1 text-xs font-semibold rounded-md no-print"
                        style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                      >
                        Claim
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {editMode && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
            <button 
              onClick={() => setEditMode(false)} 
              disabled={saving} 
              className="px-4 py-1.5 text-sm font-medium rounded-md"
              style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving} 
              className="px-4 py-1.5 text-sm font-medium rounded-md text-white" 
              style={{ background: "var(--accent)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="legend flex flex-wrap gap-4 text-xs mt-6 pt-4 border-t" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />All roles filled</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "var(--warning)" }} />Missing roles</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} />Not yet planned</span>
      </div>

    </div>
  );
}

"use client";

import { useState, useMemo, useCallback } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DevotionDaily, UserProfile } from "@/types";
import { useToast } from "@/context/ToastContext";
import { getMonToSatDates, addWeeksToDate, getShortDayLabel } from "@/lib/date";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ToolbarBtn } from "@/components/ToolbarBtn";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Inline Editor ─────────────────────────────────────────────────────────────

function InlineTiptapEditor({
  initialContent,
  onSave,
  onCancel,
  saving
}: {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const getInitial = () => {
    if (!initialContent) return "";
    try {
      return JSON.parse(initialContent);
    } catch {
      return initialContent;
    }
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: getInitial(),
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[200px] px-5 py-4 focus:outline-none text-sm",
        "data-placeholder": "Outline the teaching notes…",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg overflow-hidden mt-3 shadow-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2" style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
        <ToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")}><strong>B</strong></ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")}><em>I</em></ToolbarBtn>
        <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
        <ToolbarBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })}>H2</ToolbarBtn>
        <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
        <ToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")}>• List</ToolbarBtn>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--border-primary)" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(JSON.stringify(editor.getJSON()))}
          disabled={saving}
          className="btn"
          style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
        >
          {saving ? "Saving…" : "Save Notes"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface DevotionClientProps {
  user: UserProfile;
  initialDevotions: Record<string, DevotionDaily>;
  users: UserProfile[];
  initialTargetMonday: string;
  hasPermission: boolean;
}

export function DevotionClient({
  user,
  initialDevotions,
  users,
  initialTargetMonday,
  hasPermission,
}: DevotionClientProps) {
  const { success, error } = useToast();

  const [targetMonday, setTargetMonday] = useState(initialTargetMonday);
  const days = useMemo(() => getMonToSatDates(targetMonday), [targetMonday]);

  const [devotions, setDevotions] = useState<Record<string, DevotionDaily>>(initialDevotions);
  const [fetching, setFetching] = useState(false);
  
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});

  // Fetch when week changes
  const fetchForWeek = useCallback(async (mondayStr: string) => {
    setFetching(true);
    try {
      const weekDays = getMonToSatDates(mondayStr);
      const devSnap = await getDocs(query(collection(db, "devotion"), where("date", "in", weekDays)));
      
      const devMap: Record<string, DevotionDaily> = {};
      devSnap.docs.forEach(doc => {
        const data = doc.data() as DevotionDaily;
        devMap[data.date] = { id: doc.id, ...data };
      });
      setDevotions(devMap);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, []);

  const handleWeekChange = (offset: number) => {
    const newMonday = addWeeksToDate(targetMonday, offset);
    setTargetMonday(newMonday);
    fetchForWeek(newMonday);
    setExpandedDate(null);
  };

  const handleDayUpdate = async (date: string, updates: Partial<DevotionDaily>) => {
    if (!hasPermission) return;
    
    const existing = devotions[date] || {
      date,
      assigned_to: "",
      backup_teacher: "",
      topic: "",
      teaching_notes: "",
    };

    const newObj: DevotionDaily = {
      ...existing,
      ...updates,
      last_edited_by: user.uid
    };

    setDevotions(prev => ({ ...prev, [date]: newObj }));

    setSavingState(prev => ({ ...prev, [date]: true }));
    try {
      await setDoc(doc(db, "devotion", date), {
        ...newObj,
        updated_at: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      error("Failed to update devotion data");
    } finally {
      setSavingState(prev => ({ ...prev, [date]: false }));
    }
  };

  const handleNotesSave = async (date: string, notes: string) => {
    await handleDayUpdate(date, { teaching_notes: notes });
    success("Teaching notes saved");
    setExpandedDate(null);
  };

  const [year, month, day] = targetMonday.split("-").map(Number);
  const startD = new Date(Date.UTC(year, month - 1, day, 12));
  const endD = new Date(Date.UTC(year, month - 1, day + 5, 12));
  
  const weekLabel = `${startD.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${endD.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;

  const readyDays = days.filter(d => devotions[d]?.assigned_to && devotions[d]?.topic).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Weekly Devotion</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage daily teachings</p>
        </div>
      </div>

      <div className="week-nav flex items-center justify-center gap-4 mb-5">
        <button className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => handleWeekChange(-1)}>
          <ChevronLeft size={20} />
        </button>
        <div className="label text-center">
          <div className="wk text-base font-semibold">Week of {weekLabel}</div>
          <div className="sub text-xs" style={{ color: "var(--text-secondary)" }}>{readyDays} of 6 days ready</div>
        </div>
        <button className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors" onClick={() => handleWeekChange(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="week-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {fetching ? (
          <div className="animate-pulse p-4">
            <div className="h-64 bg-black/5 rounded-lg" />
          </div>
        ) : days.map((date) => {
          const { dow, num } = getShortDayLabel(date);
          const dev = devotions[date];
          
          const isLeaderAssigned = !!dev?.assigned_to;
          const isTopicSet = !!dev?.topic?.trim();
          
          let statusClass = "off";
          let statusIcon = "○";
          if (isLeaderAssigned && isTopicSet) {
            statusClass = "ok";
            statusIcon = "✓";
          } else if (isLeaderAssigned && !isTopicSet) {
            statusClass = "warn";
            statusIcon = "!";
          }

          const isExpanded = expandedDate === date;

          return (
            <div key={date} className="border-b last:border-b-0" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex flex-col md:flex-row md:items-center gap-3 p-4">
                
                <div className="flex flex-col gap-2 md:w-56 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 text-center shrink-0">
                      <div className="text-sm font-semibold">{dow}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{num}</div>
                    </div>
                    
                    <select
                      value={dev?.assigned_to || ""}
                      onChange={(e) => handleDayUpdate(date, { assigned_to: e.target.value })}
                      disabled={!hasPermission}
                      className="flex-1 min-w-[140px] px-2 py-1 text-xs rounded-md border"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-primary)" }}
                    >
                      <option value="">— assign teacher —</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-[3.25rem]">
                    <select
                      value={dev?.backup_teacher || ""}
                      onChange={(e) => handleDayUpdate(date, { backup_teacher: e.target.value })}
                      disabled={!hasPermission}
                      className="flex-1 min-w-[140px] px-2 py-1 text-xs rounded-md border opacity-80"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-primary)" }}
                    >
                      <option value="">— assign backup —</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-3 w-full">
                  <input
                    type="text"
                    value={dev?.topic || ""}
                    onChange={(e) => handleDayUpdate(date, { topic: e.target.value })}
                    disabled={!hasPermission || !isLeaderAssigned}
                    placeholder={isLeaderAssigned ? "Enter teaching topic" : "Assign a leader first"}
                    className="flex-1 min-w-0 px-2 py-1 text-sm rounded-md border"
                    style={{ 
                      background: "var(--bg-input)", 
                      color: "var(--text-primary)",
                      borderColor: (!isTopicSet && isLeaderAssigned) ? "var(--warning)" : "var(--border-primary)" 
                    }}
                  />
                  
                  <div className={`w-5 text-center text-sm font-bold badge ${statusClass}`}>
                    {statusIcon}
                  </div>
                </div>

                <div className="w-full md:w-auto flex justify-end shrink-0">
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : date)}
                    disabled={!isLeaderAssigned && !hasPermission}
                    className="btn w-full md:w-auto"
                  >
                    {isExpanded ? "Close Notes" : (dev?.teaching_notes ? "View Notes" : "Write Notes")}
                  </button>
                </div>

              </div>

              {/* Expandable Editor */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
                  {hasPermission || dev?.assigned_to === user.uid ? (
                    <InlineTiptapEditor
                      initialContent={dev?.teaching_notes || ""}
                      onSave={(notes) => handleNotesSave(date, notes)}
                      onCancel={() => setExpandedDate(null)}
                      saving={savingState[date] || false}
                    />
                  ) : (
                    <div className="tiptap-content text-sm mt-3 p-4 rounded-md bg-white border" style={{ borderColor: "var(--border-primary)" }} dangerouslySetInnerHTML={{ __html: dev?.teaching_notes || "<p>No notes written yet.</p>" }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="legend flex flex-wrap gap-4 text-xs mt-6 pt-4 border-t" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--success)" }} />Leader + topic set</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--warning)" }} />Leader set, topic missing</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--text-muted)" }} />No leader assigned</span>
      </div>
    </div>
  );
}

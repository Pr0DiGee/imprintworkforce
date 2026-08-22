"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState, useCallback } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Report, Department, ReportStatus } from "@/types";
import { getTargetSundayString } from "@/lib/date";
import { useToast } from "@/context/ToastContext";
import { ToolbarBtn } from "@/components/ToolbarBtn";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ReportEditorProps {
  existingReport: Report | null;
  department: Department;
  uid: string;
  onSaved?: (report: Report) => void;
  targetSunday?: string; // Passed from parent (e.g. from WeekPicker)
  disabled?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ReportEditor({
  existingReport,
  department,
  uid,
  onSaved,
  targetSunday = getTargetSundayString(),
  disabled = false,
}: ReportEditorProps) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const { success, error } = useToast();

  const initialContent = useCallback(() => {
    if (!existingReport?.content) return "";
    try {
      return JSON.parse(existingReport.content);
    } catch {
      return existingReport.content;
    }
  }, [existingReport]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent(),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[280px] px-5 py-4 focus:outline-none text-sm",
        "data-placeholder": "Start writing your department report…",
      },
    },
  });

  async function handleSave(status: ReportStatus) {
    if (!editor || disabled) return;
    setSaving(true);
    setConfirmSubmit(false); // Close confirmation modal if open

    try {
      const content = JSON.stringify(editor.getJSON());
      const docId = `${department}_${targetSunday}`;
      const reportRef = doc(db, "reports", docId);

      const timestamp = serverTimestamp();

      if (existingReport?.id) {
        await updateDoc(reportRef, {
          content,
          status,
          last_edited_by: uid,
          last_edited_at: timestamp,
          ...(status === "SUBMITTED" && existingReport.status !== "SUBMITTED" 
            ? { submitted_by: uid, submitted_at: timestamp } 
            : {})
        });
      } else {
        await setDoc(reportRef, {
          department,
          content,
          status,
          last_edited_by: uid,
          created_at: timestamp,
          last_edited_at: timestamp,
          target_sunday: targetSunday,
          ...(status === "SUBMITTED" ? { submitted_by: uid, submitted_at: timestamp } : {})
        });
      }

      const updatedReport: Report = {
        id: docId,
        department,
        content,
        status,
        last_edited_by: uid,
        created_at: existingReport?.created_at as any, // Only needed for local state
        target_sunday: targetSunday,
      };

      onSaved?.(updatedReport);
      setLastSaved(new Date());
      success(status === "SUBMITTED" ? "Report submitted successfully" : "Draft saved successfully");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to save report.");
    } finally {
      setSaving(false);
    }
  }

  if (!editor) return null;

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Toolbar */}
      {!disabled && (
        <div
          className="flex flex-wrap items-center gap-0.5 px-2 py-2"
          style={{
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          <ToolbarBtn
            title="Bold (Ctrl+B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
          >
            <strong>B</strong>
          </ToolbarBtn>

          <ToolbarBtn
            title="Italic (Ctrl+I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
          >
            <em>I</em>
          </ToolbarBtn>

          <span
            className="w-px h-5 mx-1"
            style={{ background: "var(--border-primary)" }}
          />

          <ToolbarBtn
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
          >
            H2
          </ToolbarBtn>

          <ToolbarBtn
            title="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
          >
            H3
          </ToolbarBtn>

          <span
            className="w-px h-5 mx-1"
            style={{ background: "var(--border-primary)" }}
          />

          <ToolbarBtn
            title="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
          >
            • List
          </ToolbarBtn>

          <ToolbarBtn
            title="Ordered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
          >
            1. List
          </ToolbarBtn>

          <span
            className="w-px h-5 mx-1"
            style={{ background: "var(--border-primary)" }}
          />

          <ToolbarBtn
            title="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!canUndo}
          >
            ↩
          </ToolbarBtn>

          <ToolbarBtn
            title="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!canRedo}
          >
            ↪
          </ToolbarBtn>
        </div>
      )}

      {/* Editor body */}
      <EditorContent editor={editor} />

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border-primary)",
        }}
      >
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {disabled ? (
            <span>Viewing read-only report</span>
          ) : lastSaved ? (
            <span>
              Last saved:{" "}
              {lastSaved.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : existingReport ? (
            <span>Draft loaded — unsaved changes will show here</span>
          ) : (
            <span>New report — not yet saved</span>
          )}
        </div>

        {!disabled && (
          <div className="flex gap-3 relative">
            {existingReport?.status === "SUBMITTED" ? (
              <button
                type="button"
                onClick={() => handleSave("SUBMITTED")}
                disabled={saving}
                className="px-4 py-1.5 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
                style={{ background: "var(--accent)" }}
              >
                {saving ? "Updating…" : "Update Report"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave("DRAFT")}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
                  style={{
                    background: "transparent",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)"
                  }}
                >
                  {saving ? "Saving…" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSubmit(true)}
                  disabled={saving}
                  className="px-4 py-1.5 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
                  style={{ background: "var(--accent)" }}
                >
                  Submit Report
                </button>

                {/* Inline Confirmation Popup */}
                {confirmSubmit && (
                  <div 
                    className="absolute bottom-full right-0 mb-2 p-3 rounded-md shadow-lg"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-primary)",
                      width: "260px"
                    }}
                  >
                    <p className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                      Once submitted, this report will be visible to all pastors. Continue?
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmSubmit(false)}
                        className="px-2 py-1 text-xs rounded border transition-colors"
                        style={{
                          borderColor: "var(--border-primary)",
                          color: "var(--text-secondary)"
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave("SUBMITTED")}
                        className="px-2 py-1 text-xs rounded transition-colors text-white"
                        style={{ background: "var(--accent)" }}
                      >
                        Yes, Submit
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

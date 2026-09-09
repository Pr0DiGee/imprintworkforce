"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useState, useCallback, useRef } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Report, Department, ReportStatus } from "@/types";
import { getTargetSundayString } from "@/lib/date";
import { useToast } from "@/context/ToastContext";
import { ToolbarBtn } from "@/components/ToolbarBtn";
import Image from "next/image";
import { Mail, Download } from "lucide-react";

interface ReportEditorProps {
  existingReport: Report | null;
  department: Department;
  uid: string;
  onSaved?: (report: Report) => void;
  targetSunday?: string;
  disabled?: boolean;
  hideForwardButton?: boolean;
}

export function ReportEditor({
  existingReport,
  department,
  uid,
  onSaved,
  targetSunday = getTargetSundayString(),
  disabled = false,
  hideForwardButton = false,
}: ReportEditorProps) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { success, error } = useToast();
  const pageRef = useRef<HTMLDivElement>(null);

  const initialContent = useCallback(() => {
    if (!existingReport?.content) return "";
    try {
      return JSON.parse(existingReport.content);
    } catch {
      return existingReport.content;
    }
  }, [existingReport]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent(),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[280px] px-0 py-4 focus:outline-none text-sm",
        "data-placeholder": "Start writing your department report…",
      },
    },
  });

  const departmentName = department === "BABCOCK_CAMPUS" ? "Cell Fellowship" : department.replace(/_/g, " ");
  const headerPrefix = department === "BABCOCK_CAMPUS" ? "IMPRINT BABCOCK CAMPUS" : `IMPRINT GLOBAL ${departmentName.toUpperCase()}`;

  async function handleSave(status: ReportStatus) {
    if (!editor || disabled) return;
    setSaving(true);
    setConfirmSubmit(false);

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
        created_at: existingReport?.created_at as any,
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

  async function handleDownloadPDF() {
    if (!pageRef.current) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `${departmentName}_Report_${targetSunday}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(pageRef.current).save();
    } catch (err) {
      error("Failed to generate PDF.");
      console.error(err);
    }
  }

  async function handleForwardEmail() {
    if (!pageRef.current) return;
    setSendingEmail(true);
    try {
      // Generate PDF as base64
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `${departmentName}_Report_${targetSunday}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      
      const pdfBase64 = await html2pdf().set(opt).from(pageRef.current).outputPdf('datauristring');
      
      const subject = `Weekly Report - ${departmentName} - ${targetSunday}`;
      
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "imprintglobalministry@gmail.com",
          subject,
          html: `<p>Please find attached the weekly report for ${departmentName} for ${targetSunday}.</p>`,
          attachment: {
            filename: `${departmentName}_Report_${targetSunday}.pdf`,
            content: pdfBase64,
          }
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to send email");
      }
      
      success("Report forwarded to church email!");
    } catch (err) {
      error(err instanceof Error ? err.message : "An error occurred while emailing.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleTestEmail() {
    if (!pageRef.current) return;
    setSendingEmail(true);
    try {
      // Generate PDF as base64
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `${departmentName}_Report_${targetSunday}_TEST.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      
      const pdfBase64 = await html2pdf().set(opt).from(pageRef.current).outputPdf('datauristring');
      
      const subject = `[TEST] Weekly Report - ${departmentName} - ${targetSunday}`;
      
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "zubbyobunadike@gmail.com",
          subject,
          html: `<p>This is a TEST. Please find attached the weekly report for ${departmentName} for ${targetSunday}.</p>`,
          attachment: {
            filename: `${departmentName}_Report_${targetSunday}_TEST.pdf`,
            content: pdfBase64,
          }
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to send test email");
      }
      
      success("Test report forwarded to your email!");
    } catch (err) {
      error(err instanceof Error ? err.message : "An error occurred while emailing.");
    } finally {
      setSendingEmail(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 rounded-lg sticky top-4 z-10 shadow-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
          <ToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")}><strong>B</strong></ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")}><em>I</em></ToolbarBtn>
          <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
          <ToolbarBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })}>H2</ToolbarBtn>
          <ToolbarBtn title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })}>H3</ToolbarBtn>
          <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
          <ToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")}>• List</ToolbarBtn>
          <ToolbarBtn title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")}>1. List</ToolbarBtn>
          <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
          <ToolbarBtn title="Insert Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</ToolbarBtn>
          <ToolbarBtn title="Add Row" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}>+Row</ToolbarBtn>
          <ToolbarBtn title="Add Col" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()}>+Col</ToolbarBtn>
          <ToolbarBtn title="Del Row" onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()}>-Row</ToolbarBtn>
          <ToolbarBtn title="Del Col" onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()}>-Col</ToolbarBtn>
          <ToolbarBtn title="Delete Table" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()}>Del Table</ToolbarBtn>
        </div>
      )}

      {/* A4 Page Container */}
      <div className="a4-page-wrapper-container">
        <div className="a4-page-wrapper p-8 sm:p-12 overflow-x-auto" ref={pageRef}>
          
          {/* Header */}
          <div className="flex items-center gap-6 mb-6">
            <div className="shrink-0">
              {/* The logo from public/logo.png */}
              <Image src="/logo.png" alt="Logo" width={80} height={80} className="object-contain" />
            </div>
            <div className="flex-1">
              <h4 style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{headerPrefix}</h4>
              <h1 style={{ color: '#111827', fontSize: '1.875rem', fontWeight: 700, marginTop: '4px' }}>{departmentName} Report</h1>
              <p style={{ color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Red Divider */}
          <div style={{ width: '100%', height: '2px', backgroundColor: '#b91c1c', marginBottom: '2rem' }}></div>

          {/* Editor Body */}
          <div style={{ flexGrow: 1 }}>
            <EditorContent editor={editor} />
          </div>
          
          {/* Footer Text */}
          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', paddingTop: '4rem' }}>
            {headerPrefix} {departmentName} Report
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg no-print" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-gray-100 border border-gray-200"
          >
            <Download size={16} />
            Save as PDF
          </button>
          
          {existingReport?.status === "SUBMITTED" && !hideForwardButton && (
            <>
              <button
                onClick={handleTestEmail}
                disabled={sendingEmail}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: "#f59e0b" }} // Amber color for test
              >
                <Mail size={16} />
                {sendingEmail ? "Sending..." : "Test Email"}
              </button>
              <button
                onClick={handleForwardEmail}
                disabled={sendingEmail}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: "var(--accent)" }}
              >
                <Mail size={16} />
                {sendingEmail ? "Sending..." : "Forward to Church Email"}
              </button>
            </>
          )}
        </div>

        {!disabled && (
          <div className="flex gap-3 relative">
            {existingReport?.status === "SUBMITTED" ? (
              <button
                onClick={() => handleSave("SUBMITTED")}
                disabled={saving}
                className="px-4 py-1.5 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-70"
                style={{ background: "var(--accent)" }}
              >
                {saving ? "Updating…" : "Update Report"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSave("DRAFT")}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-70"
                  style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
                >
                  {saving ? "Saving…" : "Save Draft"}
                </button>
                <button
                  onClick={() => setConfirmSubmit(true)}
                  disabled={saving}
                  className="px-4 py-1.5 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-70"
                  style={{ background: "var(--accent)" }}
                >
                  Submit Report
                </button>

                {confirmSubmit && (
                  <div className="absolute bottom-full right-0 mb-2 p-3 rounded-md shadow-lg w-[260px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
                    <p className="text-sm mb-3">Once submitted, this report will be visible to all pastors. Continue?</p>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setConfirmSubmit(false)} className="px-2 py-1 text-xs rounded border">Cancel</button>
                      <button onClick={() => handleSave("SUBMITTED")} className="px-2 py-1 text-xs rounded text-white" style={{ background: "var(--accent)" }}>Yes, Submit</button>
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

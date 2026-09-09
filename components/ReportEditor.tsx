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
import { Report, Department, ReportStatus, ReportMetric, ReportMetricStyle } from "@/types";
import { getTargetSundayString } from "@/lib/date";
import { useToast } from "@/context/ToastContext";
import { ToolbarBtn } from "@/components/ToolbarBtn";
import Image from "next/image";
import { Mail, Download, Plus, Trash2 } from "lucide-react";

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
  const [metrics, setMetrics] = useState<ReportMetric[]>(existingReport?.metrics || []);
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
          metrics,
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
          metrics,
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
        metrics,
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

      if (!res.ok) throw new Error("Failed to send email");
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

      if (!res.ok) throw new Error("Failed to send test email");
      success("Test report forwarded to your email!");
    } catch (err) {
      error(err instanceof Error ? err.message : "An error occurred while emailing.");
    } finally {
      setSendingEmail(false);
    }
  }

  function addMetric() {
    setMetrics([...metrics, { id: Date.now().toString(), value: "0", label: "New Metric", style: "square" }]);
  }

  function updateMetric(id: string, updates: Partial<ReportMetric>) {
    setMetrics(metrics.map(m => m.id === id ? { ...m, ...updates } : m));
  }

  function removeMetric(id: string) {
    setMetrics(metrics.filter(m => m.id !== id));
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
          <ToolbarBtn title="Delete Table" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.isActive("table")}>Del Table</ToolbarBtn>
          <span className="w-px h-5 mx-1" style={{ background: "var(--border-primary)" }} />
          <ToolbarBtn title="Add Metric" onClick={addMetric}><Plus size={14} className="mr-1"/> Metric</ToolbarBtn>
        </div>
      )}

      {/* A4 Page Container */}
      <div className="a4-page-wrapper p-8 sm:p-12 overflow-x-auto" ref={pageRef}>
        
        {/* Header */}
        <div className="flex items-center gap-6 mb-6">
          <div className="shrink-0">
            {/* The logo from public/logo.png */}
            <Image src="/logo.png" alt="Logo" width={80} height={80} className="object-contain" />
          </div>
          <div className="flex-1">
            <h4 className="text-gray-500 font-medium text-sm tracking-wider uppercase">{headerPrefix}</h4>
            <h1 className="text-3xl font-bold mt-1 text-gray-900">{departmentName} Report</h1>
            <p className="text-gray-500 mt-1 italic">Date: {new Date(targetSunday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Red Divider */}
        <div className="w-full h-0.5 bg-[#b91c1c] mb-8"></div>

        {/* Metrics Section */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-8">
            {metrics.map((metric) => (
              <div 
                key={metric.id} 
                className="relative group flex-1 min-w-[120px] max-w-[200px]"
              >
                {!disabled && (
                  <button 
                    onClick={() => removeMetric(metric.id)}
                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 no-print"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                
                <div 
                  className={`flex flex-col items-center justify-center p-4 h-full
                    ${metric.style === 'square' ? 'border border-gray-200' : ''}
                    ${metric.style === 'circle' ? 'border border-gray-200 rounded-full aspect-square' : ''}
                  `}
                >
                  <input
                    value={metric.value}
                    onChange={(e) => updateMetric(metric.id, { value: e.target.value })}
                    disabled={disabled}
                    className="text-3xl font-bold text-[#b91c1c] text-center bg-transparent border-none p-0 focus:ring-0 w-full"
                    placeholder="0"
                  />
                  <input
                    value={metric.label}
                    onChange={(e) => updateMetric(metric.id, { label: e.target.value })}
                    disabled={disabled}
                    className="text-sm font-medium text-gray-800 text-center bg-transparent border-none p-0 focus:ring-0 w-full mt-1"
                    placeholder="Label"
                  />
                  {(!disabled || metric.subtext) && (
                    <input
                      value={metric.subtext || ""}
                      onChange={(e) => updateMetric(metric.id, { subtext: e.target.value })}
                      disabled={disabled}
                      className="text-[10px] text-gray-500 uppercase tracking-wider text-center bg-transparent border-none p-0 focus:ring-0 w-full mt-1"
                      placeholder="SUBTEXT (OPTIONAL)"
                    />
                  )}
                </div>

                {/* Style Switcher (no print) */}
                {!disabled && (
                  <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                    <button onClick={() => updateMetric(metric.id, { style: 'square' })} className={`w-3 h-3 border border-gray-400 ${metric.style === 'square' ? 'bg-gray-400' : ''}`}></button>
                    <button onClick={() => updateMetric(metric.id, { style: 'circle' })} className={`w-3 h-3 border border-gray-400 rounded-full ${metric.style === 'circle' ? 'bg-gray-400' : ''}`}></button>
                    <button onClick={() => updateMetric(metric.id, { style: 'minimal' })} className={`w-3 h-3 text-[10px] leading-none ${metric.style === 'minimal' ? 'font-bold' : ''}`}>M</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Editor Body */}
        <EditorContent editor={editor} />
        
        {/* Footer Text */}
        <div className="mt-16 text-center text-xs text-gray-400 italic">
          {headerPrefix} {departmentName} Report
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

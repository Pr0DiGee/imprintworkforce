"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Report } from "@/types";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { Mail } from "lucide-react";

interface ReadOnlyReportProps {
  report: Report;
}

export function ReadOnlyReport({ report }: ReadOnlyReportProps) {
  const [sending, setSending] = useState(false);
  const { success, error } = useToast();

  let content: object | string = "";
  try {
    content = JSON.parse(report.content);
  } catch {
    content = report.content;
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: "tiptap-content px-5 py-4 text-sm text-gray-800",
      },
    },
  });

  const handleSendEmail = async () => {
    if (!editor) return;
    setSending(true);
    try {
      const htmlContent = editor.getHTML();
      const subject = `Weekly Report - ${report.department.replace(/_/g, " ")} - ${report.target_sunday}`;
      
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "imprintglobalministry@gmail.com",
          subject,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send email");
      }

      success("Report successfully forwarded to church email!");
    } catch (err) {
      error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSending(false);
    }
  };

  if (!editor) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
      <EditorContent editor={editor} />
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end no-print">
        <button
          onClick={handleSendEmail}
          disabled={sending}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: "var(--accent)" }}
        >
          <Mail size={16} />
          {sending ? "Sending..." : "Forward to Church Email"}
        </button>
      </div>
    </div>
  );
}

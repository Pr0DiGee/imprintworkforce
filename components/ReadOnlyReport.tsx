"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Report } from "@/types";

interface ReadOnlyReportProps {
  report: Report;
}

export function ReadOnlyReport({ report }: ReadOnlyReportProps) {
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

  if (!editor) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <EditorContent editor={editor} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ReportEditor } from "@/components/ReportEditor";
import { Report, Department, UserProfile } from "@/types";
import { formatTargetSunday } from "@/lib/date";
import { WeekPicker } from "@/components/WeekPicker";
import { Printer } from "lucide-react";

interface ReportsClientProps {
  user: UserProfile;
  currentSunday: string;
  initialReport: Report | null;
}

export function ReportsClient({
  user,
  currentSunday,
  initialReport,
}: ReportsClientProps) {
  const departments = user.departments || [];
  
  // Default to first department if user has multiple, otherwise empty
  const [activeDept, setActiveDept] = useState<Department | "">(
    departments.length > 0 ? departments[0] : ""
  );

  const [report, setReport] = useState<Report | null>(initialReport);
  const [editorMode, setEditorMode] = useState<"PROMPT" | "CONTINUE" | "NEW">(initialReport ? "PROMPT" : "NEW");
  const [fetching, setFetching] = useState(false);
  const [targetSunday, setTargetSunday] = useState(currentSunday);

  let isReadOnly = false;
  if (report?.status === "SUBMITTED" && report.submitted_at) {
    const submittedTime = (report.submitted_at as any).toDate 
      ? (report.submitted_at as any).toDate().getTime() 
      : new Date(report.submitted_at as unknown as string).getTime();
    const now = new Date().getTime();
    const hoursSinceSubmission = (now - submittedTime) / (1000 * 60 * 60);
    if (hoursSinceSubmission > 24) {
      isReadOnly = true;
    }
  }

  async function handleWeekOrDeptChange(newSunday: string, newDept: Department | "") {
    if (!newDept) return;
    
    setFetching(true);
    try {
      const docId = `${newDept}_${newSunday}`;
      const snap = await getDoc(doc(db, "reports", docId));
      if (snap.exists()) {
        setReport({ id: snap.id, ...snap.data() } as Report);
        setEditorMode("PROMPT");
      } else {
        setReport(null);
        setEditorMode("NEW");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  if (departments.length === 0) {
    return (
      <div
        className="max-w-xl rounded-lg px-5 py-4"
        style={{
          background: "var(--warning-subtle)",
          border: "1px solid var(--warning)",
        }}
      >
        <h2
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--warning)" }}
        >
          Department not set
        </h2>
        <p className="text-sm" style={{ color: "var(--warning)" }}>
          Your account doesn&apos;t have a department assigned yet. Ask your
          administrator to set your department in the Admin panel.
        </p>
      </div>
    );
  }

  const isEdit = Boolean(report);

  return (
    <div className="max-w-3xl space-y-4 print-full-width">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Weekly Report {activeDept ? `— ${activeDept.replace(/_/g, " ")}` : ""}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {isEdit ? "Editing draft for" : "New report for"}{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {formatTargetSunday(targetSunday)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:opacity-80 flex items-center gap-2"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          >
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print bg-card p-3 rounded-lg border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <div className="flex items-center gap-4">
          <WeekPicker
            value={targetSunday}
            onChange={(val) => {
              setTargetSunday(val);
              handleWeekOrDeptChange(val, activeDept);
            }}
          />
          
          {departments.length > 1 && (
            <select
              value={activeDept}
              onChange={(e) => {
                const val = e.target.value as Department;
                setActiveDept(val);
                handleWeekOrDeptChange(targetSunday, val);
              }}
              className="px-2 py-1.5 text-sm rounded-md"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              {departments.map(d => (
                <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
              ))}
            </select>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full`}
            style={{
              background: isReadOnly
                ? "var(--bg-elevated)"
                : report?.status === "SUBMITTED"
                ? "var(--success-subtle)"
                : report?.status === "DRAFT"
                ? "var(--warning-subtle)"
                : "var(--accent-subtle)",
              color: isReadOnly
                ? "var(--text-secondary)"
                : report?.status === "SUBMITTED"
                ? "var(--success)"
                : report?.status === "DRAFT"
                ? "var(--warning)"
                : "var(--accent-text)",
              border: `1px solid ${
                isReadOnly
                  ? "var(--border-primary)"
                  : report?.status === "SUBMITTED"
                  ? "var(--success)"
                  : report?.status === "DRAFT"
                  ? "var(--warning)"
                  : "var(--accent)"
              }`,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full`}
              style={{
                background: isReadOnly
                  ? "var(--text-secondary)"
                  : report?.status === "SUBMITTED"
                  ? "var(--success)"
                  : report?.status === "DRAFT"
                  ? "var(--warning)"
                  : "var(--accent)",
              }}
            />
            {isReadOnly 
              ? "Read Only" 
              : report?.status === "SUBMITTED" 
              ? "Submitted" 
              : report?.status === "DRAFT"
              ? "Draft"
              : "New"}
          </span>
        </div>
      </div>

      {fetching ? (
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-black/5 rounded-lg" />
        </div>
      ) : activeDept ? (
        <>
          {isReadOnly && report?.status === "SUBMITTED" && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
              <strong>Locked:</strong> This report was submitted over 24 hours ago and can no longer be edited.
            </div>
          )}
          {editorMode === "PROMPT" && !isReadOnly ? (
          <div className="bg-card p-8 rounded-xl border text-center space-y-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
            <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>An existing report was found</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              There is already a {report?.status === "SUBMITTED" ? "submitted" : "draft"} report for this department this week.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setEditorMode("CONTINUE")}
                className="btn px-6 py-2.5"
                style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
              >
                Continue Existing Report
              </button>
              <button
                onClick={() => {
                  if (confirm("Are you sure? This will overwrite the existing report when you save.")) {
                    setEditorMode("NEW");
                  }
                }}
                className="btn px-6 py-2.5"
                style={{ background: "var(--bg-elevated)", color: "var(--danger)", border: "1px solid var(--danger)" }}
              >
                Create New Report (Overwrite)
              </button>
            </div>
          </div>
        ) : (
          <ReportEditor
            key={`${activeDept}_${targetSunday}_${editorMode}`}
            existingReport={editorMode === "NEW" ? null : report}
            department={activeDept}
            uid={user.uid}
            targetSunday={targetSunday}
            disabled={isReadOnly}
            onSaved={(saved) => {
              setReport(saved);
              setEditorMode("CONTINUE");
            }}
          />
        )}
        </>
      ) : null}
    </div>
  );
}

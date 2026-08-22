"use client";

import { useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ReadOnlyReport } from "@/components/ReadOnlyReport";
import { Report, Department, DEPARTMENTS, DEPARTMENT_LABELS } from "@/types";
import { formatTargetSunday } from "@/lib/date";
import { useRouter } from "next/navigation";
import { WeekPicker } from "@/components/WeekPicker";
import { Printer } from "lucide-react";

interface ReportsAllClientProps {
  targetSunday: string;
  initialReportsList: Report[];
}

export function ReportsAllClient({
  targetSunday: initialTargetSunday,
  initialReportsList,
}: ReportsAllClientProps) {
  const router = useRouter();
  const [targetSunday, setTargetSunday] = useState(initialTargetSunday);
  const [fetching, setFetching] = useState(false);
  const [reportsList, setReportsList] = useState<Report[]>(initialReportsList);

  const fetchReportsForWeek = useCallback(async (dateStr: string) => {
    setFetching(true);
    try {
      const snap = await getDocs(
        query(collection(db, "reports"), where("target_sunday", "==", dateStr))
      );
      setReportsList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report)));
      
      // Update URL without triggering a full page reload so it can be shared
      router.replace(`/dashboard/reports/all?date=${dateStr}`);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, [router]);

  // Convert list to a lookup map for easy rendering
  const reportsMap: Record<Department, Report | null> = {} as any;
  DEPARTMENTS.forEach((dept) => {
    reportsMap[dept] = reportsList.find((r) => r.department === dept) ?? null;
  });

  const submittedCount = reportsList.filter(r => r.status === "SUBMITTED").length;
  const draftCount = reportsList.filter(r => r.status === "DRAFT").length;

  return (
    <div className="max-w-3xl space-y-6 print-full-width">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            All Department Reports
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {formatTargetSunday(targetSunday)} ·{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {submittedCount}/{DEPARTMENTS.length} submitted
            </span>
            {draftCount > 0 && (
              <span className="ml-2 italic" style={{ color: "var(--warning)" }}>
                ({draftCount} draft in progress)
              </span>
            )}
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
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print p-3 rounded-lg border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <WeekPicker
          value={targetSunday}
          onChange={(val) => {
            setTargetSunday(val);
            fetchReportsForWeek(val);
          }}
        />
      </div>

      {fetching ? (
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-black/5 rounded-lg" />
        </div>
      ) : (
        DEPARTMENTS.map((dept) => {
          const report = reportsMap[dept];
          const isSubmitted = report?.status === "SUBMITTED";
          const isDraft = report?.status === "DRAFT";

          // If it's a draft and not submitted, we can either hide it or show it as a draft indicator.
          // The pastor should probably just see it's a "Draft in progress" but not the content until submitted.
          // Or they can see the draft content. Let's hide the content until submitted, just show indicator.

          return (
            <section key={dept} className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {DEPARTMENT_LABELS[dept]}
                </h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full`}
                  style={{
                    background: isSubmitted 
                      ? "var(--success-subtle)" 
                      : isDraft 
                      ? "var(--warning-subtle)"
                      : "var(--bg-elevated)",
                    color: isSubmitted 
                      ? "var(--success)" 
                      : isDraft 
                      ? "var(--warning)"
                      : "var(--text-muted)",
                    border: `1px solid ${
                      isSubmitted 
                        ? "var(--success)" 
                        : isDraft
                        ? "var(--warning)"
                        : "transparent"
                    }`,
                  }}
                >
                  {isSubmitted ? "Submitted" : isDraft ? "Draft in progress" : "Pending"}
                </span>
              </div>

              {isSubmitted ? (
                <ReadOnlyReport report={report} />
              ) : (
                <div
                  className="rounded-lg px-5 py-6 text-center border-dashed border-2"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {isDraft ? "A worker is currently drafting this report." : "No report submitted yet."}
                  </p>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

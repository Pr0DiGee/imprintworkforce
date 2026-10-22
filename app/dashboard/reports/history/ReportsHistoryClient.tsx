"use client";

import { formatTargetSunday } from "@/lib/date";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

interface WeekSummary {
  targetSunday: string;
  count: number;
}

interface ReportsHistoryClientProps {
  history: WeekSummary[];
  /** How many weeks back this list covers */
  weeks: number;
  nextWeeks: number;
}

export function ReportsHistoryClient({ history, weeks, nextWeeks }: ReportsHistoryClientProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Report History
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Browse past weeks to view archived department reports. Showing the last {weeks} weeks.
        </p>
      </div>

      <div className="space-y-3">
        {history.length === 0 ? (
          <EmptyState
            icon={ArrowRight}
            title="No history found"
            description="No reports have been archived yet. Once reports are submitted, past weeks will appear here."
          />
        ) : (
          history.map((week) => (
            <Link
              key={week.targetSunday}
              href={`/dashboard/reports/all?date=${week.targetSunday}`}
              className="flex items-center justify-between p-4 rounded-lg transition-transform hover:scale-[1.01]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatTargetSunday(week.targetSunday)}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {week.count} department {week.count === 1 ? "report" : "reports"}
                </p>
              </div>
              <ArrowRight size={18} style={{ color: "var(--text-muted)" }} />
            </Link>
          ))
        )}
      </div>

      <div className="text-center">
        <Link
          href={`/dashboard/reports/history?weeks=${nextWeeks}`}
          scroll={false}
          className="inline-block px-4 py-1.5 text-sm font-medium rounded-md"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
        >
          Show older weeks
        </Link>
      </div>
    </div>
  );
}

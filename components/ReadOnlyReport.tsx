"use client";

import { Report } from "@/types";
import { ReportEditor } from "./ReportEditor";

interface ReadOnlyReportProps {
  report: Report;
}

export function ReadOnlyReport({ report }: ReadOnlyReportProps) {
  return (
    <ReportEditor 
      existingReport={report} 
      department={report.department} 
      uid={report.last_edited_by} 
      targetSunday={report.target_sunday}
      disabled={true} 
      hideForwardButton={true}
    />
  );
}

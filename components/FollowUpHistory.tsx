"use client";

import { useEffect, useState } from "react";
import type { FollowUpContact, FollowUpLog } from "@/types";
import { formatRelativeCheckInDate } from "@/lib/date";
import { getFollowUpHistory } from "@/app/dashboard/followup/actions";

const METHOD_LABELS = { PHYSICAL: "Physical", CALL: "Call", TEXT: "Text" } as const;

/** The latest log, from the summary stored on the contact (no log reads needed). */
export function latestLogOf(contact: FollowUpContact) {
  if (!contact.last_log_at) return undefined;
  return {
    method: contact.last_log_method,
    methodLabel: contact.last_log_method ? METHOD_LABELS[contact.last_log_method] : "",
    notes: contact.last_log_notes ?? "",
    logged_at: contact.last_log_at as string,
    worker_id: contact.last_log_by ?? "",
  };
}

/** A contact's full log history, fetched from the server when this mounts. */
export function FollowUpHistory({
  contactId,
  userMap,
  className = "",
}: {
  contactId: string;
  userMap: Record<string, string>;
  className?: string;
}) {
  const [logs, setLogs] = useState<FollowUpLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFollowUpHistory(contactId).then((list) => {
      if (!cancelled) setLogs(list);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (logs === null) {
    return <p className={`text-xs italic ${className}`} style={{ color: "var(--text-muted)" }}>Loading history…</p>;
  }
  if (logs.length === 0) {
    return <p className={`text-xs italic ${className}`} style={{ color: "var(--text-muted)" }}>No follow-ups logged yet.</p>;
  }

  return (
    <div className={`space-y-2 max-h-48 overflow-y-auto pr-1 ${className}`}>
      {logs.map((log) => (
        <div key={log.id} className="p-2 rounded text-xs bg-black/5 dark:bg-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{METHOD_LABELS[log.method] ?? log.method}</span>
            <span style={{ color: "var(--text-muted)" }}>{formatRelativeCheckInDate(log.logged_at as unknown as string)}</span>
          </div>
          {log.notes && <p style={{ color: "var(--text-secondary)" }}>{log.notes}</p>}
          <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            By: {userMap[log.worker_id] || "Former worker"}
          </div>
        </div>
      ))}
    </div>
  );
}

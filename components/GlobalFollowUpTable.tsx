"use client";

import React, { useState } from "react";
import { FollowUpContact, FollowUpLog } from "@/types";
import { Search } from "lucide-react";

interface GlobalFollowUpTableProps {
  contacts: FollowUpContact[];
  logs: FollowUpLog[];
  userMap: Record<string, string>;
  targetSunday: string;
}

import { formatRelativeCheckInDate } from "@/lib/date";

export function GlobalFollowUpTable({ contacts, logs, userMap, targetSunday }: GlobalFollowUpTableProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.address && c.address.toLowerCase().includes(q));
  });

  const getLatestLog = (contactId: string) => {
    return logs.find(l => l.contact_id === contactId); // logs are sorted desc
  };

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const logA = getLatestLog(a.id!);
    const logB = getLatestLog(b.id!);
    
    if (!logA && !logB) return 0;
    if (!logA) return 1;
    if (!logB) return -1;
    
    const timeA = new Date(logA.logged_at as any).getTime();
    const timeB = new Date(logB.logged_at as any).getTime();
    
    return timeB - timeA;
  });

  return (
    <div className="rounded-lg overflow-hidden shadow-sm border w-full" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
      <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
        <Search size={18} className="text-[var(--text-muted)]" />
        <input 
          type="text" 
          placeholder="Search by name, phone or address..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-sm w-full"
          style={{ color: "var(--text-primary)" }}
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Person</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Assigned To</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Last Check-in</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Method</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Comments</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sortedContacts.map(contact => {
              const latestLog = getLatestLog(contact.id!);
              const contactLogs = logs.filter(l => l.contact_id === contact.id);
              const isExpanded = expandedId === contact.id;
              
              return (
                <React.Fragment key={contact.id}>
                <tr className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{contact.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{contact.phone}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    {userMap[contact.assigned_to] || "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                      {formatRelativeCheckInDate(latestLog?.logged_at as any)}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {latestLog ? (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border-primary)]" style={{ background: "var(--bg-elevated)" }}>
                        {latestLog.method === "PHYSICAL" ? "Physical" : latestLog.method === "CALL" ? "Call" : "Text"}
                      </span>
                    ) : (
                      <span className="text-xs italic text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div className="truncate max-w-[200px]" title={latestLog?.notes || ""}>
                      {latestLog?.notes || <span className="italic text-[var(--text-muted)]">No comments</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => setExpandedId(isExpanded ? null : contact.id!)}
                      className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                      style={{ background: isExpanded ? "var(--accent)" : "var(--bg-input)", color: isExpanded ? "#fff" : "var(--text-primary)" }}
                    >
                      {isExpanded ? "Hide" : `View (${contactLogs.length})`}
                    </button>
                  </td>
                </tr>
                {isExpanded && contactLogs.length > 0 && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="bg-black/5 dark:bg-white/5 p-4 inset-shadow-sm border-b border-[var(--border-primary)]">
                        <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Log History ({contactLogs.length})</h4>
                        <div className="space-y-2">
                          {contactLogs.map(log => (
                            <div key={log.id} className="bg-[var(--bg-card)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{log.method}</span>
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeCheckInDate(log.logged_at as any)}</span>
                              </div>
                              {log.notes && <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{log.notes}</p>}
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                By: {userMap[log.worker_id] || "Unknown"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            
            {sortedContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
                  No follow-ups found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

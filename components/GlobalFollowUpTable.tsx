"use client";

import { useState } from "react";
import { FollowUpContact, FollowUpLog } from "@/types";
import { Search } from "lucide-react";

interface GlobalFollowUpTableProps {
  contacts: FollowUpContact[];
  logs: FollowUpLog[];
  userMap: Record<string, string>;
  targetSunday: string;
}

export function GlobalFollowUpTable({ contacts, logs, userMap, targetSunday }: GlobalFollowUpTableProps) {
  const [search, setSearch] = useState("");

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.address && c.address.toLowerCase().includes(q));
  });

  const getLatestLog = (contactId: string) => {
    return logs.find(l => l.contact_id === contactId); // logs are sorted desc
  };

  const hasLoggedThisWeek = (contactId: string) => {
    return logs.some(l => l.contact_id === contactId && l.target_sunday === targetSunday);
  };

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
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Check-in this week?</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Method</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Comments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredContacts.map(contact => {
              const checkedIn = hasLoggedThisWeek(contact.id!);
              const latestLog = getLatestLog(contact.id!);
              
              return (
                <tr key={contact.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{contact.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{contact.phone}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    {userMap[contact.assigned_to] || "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    {checkedIn ? (
                      <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--success-subtle)", color: "var(--success)" }}>
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                        No
                      </span>
                    )}
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
                </tr>
              );
            })}
            
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
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

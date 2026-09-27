import re

with open('components/GlobalFollowUpTable.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the table wrapper hidden on mobile
content = content.replace(
    '<div className="overflow-x-auto">',
    '<div className="hidden md:block overflow-x-auto">'
)

mobile_block = """
      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-4 mt-2">
        {sortedContacts.map((contact) => {
          const contactLogs = logs.filter(l => l.contact_id === contact.id).sort((a, b) => b.logged_at.toMillis() - a.logged_at.toMillis());
          const latestLog = contactLogs[0];
          const isExpanded = expandedId === contact.id;

          return (
            <div key={contact.id} className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border-primary)] shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-base text-[var(--text-primary)]">{contact.name}</div>
                  <div className="text-sm text-[var(--text-muted)] flex items-center gap-2 mt-1">
                    <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`} className="hover:underline text-[var(--accent)]">{contact.phone}</a>
                    <a 
                      href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#25D366]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413Z"/>
                      </svg>
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)]">Worker</div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{userMap[contact.assigned_to] || "Unknown"}</div>
                </div>
              </div>

              <div className="bg-[var(--bg-elevated)] p-3 rounded border border-[var(--border-subtle)]">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">Latest Log</div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)]">
                    {latestLog ? (latestLog.method === "PHYSICAL" ? "Physical" : latestLog.method === "CALL" ? "Call" : "Text") : "None"}
                  </span>
                </div>
                <div className="text-sm text-[var(--text-primary)] line-clamp-2">
                  {latestLog?.notes || <span className="italic text-[var(--text-muted)]">No comments</span>}
                </div>
                {latestLog && (
                  <div className="text-xs text-[var(--text-muted)] mt-1.5">
                    {formatRelativeCheckInDate(latestLog.logged_at as any)}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setExpandedId(isExpanded ? null : contact.id!)}
                className="w-full text-xs font-medium py-2 rounded transition-colors border border-[var(--border-primary)] mt-1"
                style={{ background: isExpanded ? "var(--bg-elevated)" : "transparent", color: "var(--text-primary)" }}
              >
                {isExpanded ? "Hide History" : `View History (${contactLogs.length})`}
              </button>

              {isExpanded && contactLogs.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-[var(--border-primary)] pt-3">
                  {contactLogs.map(log => (
                    <div key={log.id} className="bg-[var(--bg-input)] p-3 rounded">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm text-[var(--text-primary)]">{log.method}</span>
                        <span className="text-xs text-[var(--text-muted)]">{formatRelativeCheckInDate(log.logged_at as any)}</span>
                      </div>
                      {log.notes && <p className="text-sm mb-2 text-[var(--text-secondary)]">{log.notes}</p>}
                      <div className="text-xs text-[var(--text-muted)]">
                        By: {userMap[log.worker_id] || "Unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {sortedContacts.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)] italic text-sm border border-[var(--border-primary)] rounded-lg">
            No follow-ups found.
          </div>
        )}
      </div>
"""

content = content.replace(
    '</table>\n      </div>',
    f'</table>\n      </div>\n{mobile_block}'
)

with open('components/GlobalFollowUpTable.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated GlobalFollowUpTable with mobile cards.")

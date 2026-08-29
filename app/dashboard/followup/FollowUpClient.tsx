"use client";

import { useState, useMemo } from "react";
import { UserProfile, FollowUpContact, FollowUpLog, FollowUpMethod } from "@/types";
import { format } from "date-fns";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Phone, MessageSquare, MapPin, User, CheckCircle2, UserCheck, Search, Plus } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { GlobalFollowUpTable } from "@/components/GlobalFollowUpTable";

interface FollowUpClientProps {
  user: UserProfile;
  contacts: FollowUpContact[];
  logs: FollowUpLog[];
  userMap: Record<string, string>;
  targetSunday: string;
}

type Tab = "MY_FOLLOW_UPS" | "GLOBAL_LIST";

export function FollowUpClient({ user, contacts, logs, userMap, targetSunday }: FollowUpClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("MY_FOLLOW_UPS");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToast();

  const myContacts = useMemo(() => {
    return contacts.filter(c => c.assigned_to === user.uid);
  }, [contacts, user.uid]);

  const filteredContacts = useMemo(() => {
    const list = activeTab === "MY_FOLLOW_UPS" ? myContacts : contacts;
    if (!searchQuery) return list;
    const lowerQ = searchQuery.toLowerCase();
    return list.filter(c => 
      c.name.toLowerCase().includes(lowerQ) || 
      c.phone.toLowerCase().includes(lowerQ) ||
      (c.address && c.address.toLowerCase().includes(lowerQ))
    );
  }, [activeTab, myContacts, contacts, searchQuery]);

  // Helper to check if a contact was followed up this week
  const hasLoggedThisWeek = (contactId: string) => {
    return logs.some(l => l.contact_id === contactId && l.target_sunday === targetSunday);
  };

  const getLatestLog = (contactId: string) => {
    return logs.find(l => l.contact_id === contactId); // Logs are already sorted desc
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Follow-Up</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Track and log your weekly follow-up assignments. Target Sunday: <span className="font-medium">{targetSunday}</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <Plus size={16} />
          New Contact
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--bg-input)] rounded-lg p-1 border w-fit mb-6" style={{ borderColor: "var(--border-primary)" }}>
        <button
          onClick={() => setActiveTab("MY_FOLLOW_UPS")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "MY_FOLLOW_UPS" ? "shadow-sm" : ""}`}
          style={{
            background: activeTab === "MY_FOLLOW_UPS" ? "var(--bg-card)" : "transparent",
            color: activeTab === "MY_FOLLOW_UPS" ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          My Follow-Ups ({myContacts.length})
        </button>
        <button
          onClick={() => setActiveTab("GLOBAL_LIST")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "GLOBAL_LIST" ? "shadow-sm" : ""}`}
          style={{
            background: activeTab === "GLOBAL_LIST" ? "var(--bg-card)" : "transparent",
            color: activeTab === "GLOBAL_LIST" ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          Global List
        </button>
      </div>

      {activeTab === "GLOBAL_LIST" ? (
        <GlobalFollowUpTable 
          contacts={contacts}
          logs={logs}
          userMap={userMap}
          targetSunday={targetSunday}
        />
      ) : (
        <>
          <div className="relative w-full sm:w-72 mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map(contact => {
              const completedThisWeek = hasLoggedThisWeek(contact.id!);
              const latestLog = getLatestLog(contact.id!);
              return (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  user={user}
                  userMap={userMap}
                  completedThisWeek={completedThisWeek}
                  latestLog={latestLog}
                  targetSunday={targetSunday}
                  readOnly={false}
                />
              );
            })}
            {filteredContacts.length === 0 && (
              <div className="col-span-full py-12 text-center" style={{ color: "var(--text-muted)" }}>
                No contacts found matching your criteria.
              </div>
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          user={user}
          onSuccess={() => {
            setShowAddModal(false);
            toast.success("Contact added successfully");
            // The router will refresh automatically due to standard practices, 
            // but we rely on a client-side reload or just wait for the next refetch.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({
  contact,
  user,
  userMap,
  completedThisWeek,
  latestLog,
  targetSunday,
  readOnly
}: {
  contact: FollowUpContact;
  user: UserProfile;
  userMap: Record<string, string>;
  completedThisWeek: boolean;
  latestLog?: FollowUpLog;
  targetSunday: string;
  readOnly: boolean;
}) {
  const [logging, setLogging] = useState(false);
  const [logMethod, setLogMethod] = useState<FollowUpMethod>("CALL");
  const [logNotes, setLogNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleLog = async () => {
    if (!contact.id) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "followup_logs"), {
        contact_id: contact.id,
        worker_id: user.uid,
        method: logMethod,
        notes: logNotes.trim(),
        target_sunday: targetSunday,
        logged_at: serverTimestamp()
      });
      toast.success("Follow-up logged successfully");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to log follow-up");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-xl flex flex-col relative overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Top Banner Indicator */}
      <div 
        className="h-1.5 w-full" 
        style={{ background: completedThisWeek ? "var(--success)" : "var(--accent)" }} 
      />

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{contact.name}</h3>
            <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              <UserCheck size={12} />
              <span>{contact.assigned_to === user.uid ? "You" : (userMap[contact.assigned_to] || "Unknown Worker")}</span>
            </div>
          </div>
          {completedThisWeek && (
            <div className="bg-emerald-500/10 text-emerald-500 rounded-full p-1" title="Logged this week">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>

        <div className="space-y-2 mt-2 text-sm flex-1" style={{ color: "var(--text-secondary)" }}>
          <div className="flex items-center gap-2">
            <Phone size={14} className="shrink-0" />
            <span>{contact.phone}</span>
          </div>
          {contact.address && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{contact.address}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
          {logging ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex gap-2">
                {(["PHYSICAL", "CALL", "TEXT"] as FollowUpMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setLogMethod(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border ${logMethod === m ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]' : 'border-[var(--border-primary)]'}`}
                  >
                    {m === "PHYSICAL" ? "Physical" : m === "CALL" ? "Call" : "Text"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Optional notes..."
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setLogging(false)}
                  className="flex-1 py-1.5 text-xs font-medium rounded"
                  style={{ background: "var(--bg-input)" }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLog}
                  className="flex-1 py-1.5 text-xs font-medium rounded text-white"
                  style={{ background: "var(--accent)" }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Log"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {latestLog ? (
                  <span>
                    Last: {latestLog.method} • {latestLog.logged_at ? new Date((latestLog.logged_at as any)).toLocaleDateString() : "Recent"}
                  </span>
                ) : (
                  <span>No activity yet</span>
                )}
              </div>
              {!readOnly && (
                <button
                  onClick={() => setLogging(true)}
                  className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                  style={{ background: completedThisWeek ? "var(--bg-input)" : "var(--accent)", color: completedThisWeek ? "var(--text-primary)" : "#fff" }}
                >
                  {completedThisWeek ? "Log Again" : "Log Activity"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Contact Modal ────────────────────────────────────────────────────────

function AddContactModal({ onClose, user, onSuccess }: { onClose: () => void, user: UserProfile, onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "followup_contacts"), {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        assigned_to: user.uid,
        created_at: serverTimestamp()
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add contact");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
      >
        <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add New Contact</h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
              placeholder="+234..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Address (Optional)</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", resize: "none" }}
              placeholder="123 Street Name..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              disabled={loading}
              style={{ color: "var(--text-primary)", background: "var(--bg-page)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg text-white"
              disabled={loading || !name || !phone}
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Adding..." : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

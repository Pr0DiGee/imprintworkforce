"use client";

import { useState } from "react";
import { UserProfile, EvangelismContact } from "@/types";
import { Search, Plus } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useToast } from "@/context/ToastContext";

interface EvangelismClientProps {
  user: UserProfile;
  contacts: EvangelismContact[];
  userMap: Record<string, string>;
}

export function EvangelismClient({ user, contacts, userMap }: EvangelismClientProps) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToast();

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const reachedOutName = (userMap[c.reached_out_by] || "").toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || reachedOutName.includes(q);
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Evangelism</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Global list of people reached out to during evangelism.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <Plus size={16} />
          Add Contact
        </button>
      </div>

      <div className="rounded-lg overflow-hidden shadow-sm border w-full" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elevated)" }}>
          <Search size={18} className="text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search by name, phone, or worker..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-sm w-full"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Person Reached Out To</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Worker (Reached Out By)</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredContacts.map(contact => {
                const addedAt = contact.created_at ? new Date((contact.created_at as any)).toLocaleDateString() : "Recent";
                
                return (
                  <tr key={contact.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{contact.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{contact.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {userMap[contact.reached_out_by] || "Unknown"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Added by {contact.added_by === user.uid ? "You" : userMap[contact.added_by]}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {addedAt}
                    </td>
                  </tr>
                );
              })}
              
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-muted)] italic text-sm">
                    No evangelism contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddContactModal 
          onClose={() => setShowAddModal(false)}
          userMap={userMap}
          currentUser={user}
          onSuccess={() => {
            setShowAddModal(false);
            toast.success("Contact added successfully");
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ─── Add Contact Modal ────────────────────────────────────────────────────────

function AddContactModal({ onClose, userMap, currentUser, onSuccess }: { onClose: () => void, userMap: Record<string, string>, currentUser: UserProfile, onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reachedOutBy, setReachedOutBy] = useState(currentUser.uid);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Create an array of workers for the dropdown, sorted alphabetically
  const workers = Object.entries(userMap).map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !reachedOutBy) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "evangelism_contacts"), {
        name: name.trim(),
        phone: phone.trim(),
        reached_out_by: reachedOutBy,
        added_by: currentUser.uid,
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
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Add Evangelism Contact</h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Person's Name</label>
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Person's Phone Number</label>
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Who reached out to them?</label>
            <select
              required
              value={reachedOutBy}
              onChange={(e) => setReachedOutBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
            >
              {workers.map(w => (
                <option key={w.uid} value={w.uid}>{w.uid === currentUser.uid ? `Me (${w.name})` : w.name}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              You can select another worker if you are adding this record on their behalf.
            </p>
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
              disabled={loading || !name || !phone || !reachedOutBy}
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Saving..." : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

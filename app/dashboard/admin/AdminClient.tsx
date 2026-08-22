"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  UserProfile,
  AppRole,
  Department,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
} from "@/types";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/Avatar";

const ALL_ROLES: AppRole[] = ["WORKER", "PASTOR", "LEAD_PASTOR", "DEVOTION_LEAD"];

const ROLE_LABELS: Record<AppRole, string> = {
  WORKER: "Worker",
  PASTOR: "Pastor",
  LEAD_PASTOR: "Lead Pastor",
  DEVOTION_LEAD: "Devotion Lead",
};

interface AdminClientProps {
  user: UserProfile;
  initialUsers: UserProfile[];
}

export function AdminClient({ user: currentUser, initialUsers }: AdminClientProps) {
  const { success, error } = useToast();

  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("WORKER");
  
  // Use arrays for departments to align with UserProfile.departments
  const [editDepts, setEditDepts] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit(user: UserProfile) {
    setEditingUid(user.uid);
    setEditRole(user.role);
    setEditDepts(user.departments || (user.department ? [user.department as Department] : []));
  }

  function cancelEdit() {
    setEditingUid(null);
  }

  async function handleSave(uid: string) {
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", uid), {
        role: editRole,
        departments: editDepts,
        // Sync the old field for backwards compatibility if needed
        department: editDepts.length > 0 ? editDepts[0] : "",
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid 
            ? { ...u, role: editRole, departments: editDepts, department: editDepts.length > 0 ? editDepts[0] : "" } 
            : u
        )
      );

      const userName = users.find((u) => u.uid === uid)?.name ?? uid;
      success(`Updated ${userName} → ${ROLE_LABELS[editRole]}`);
      setEditingUid(null);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setSaving(false);
    }
  }

  const toggleDept = (dept: Department) => {
    setEditDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const roleStyle = (r: AppRole) => {
    switch(r) {
      case "LEAD_PASTOR":
        return { background: "var(--accent-subtle)", color: "var(--accent-text)", border: "1px solid var(--accent)" };
      case "PASTOR":
        return { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" };
      case "DEVOTION_LEAD":
        return { background: "var(--warning-subtle)", color: "var(--warning)", border: "1px solid var(--warning)" };
      case "WORKER":
        return { background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" };
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          User Management
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {users.length} registered user{users.length !== 1 ? "s" : ""} · Assign roles and departments
        </p>
      </div>

      <div
        className="rounded-lg overflow-hidden shadow-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Name</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Email</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Role</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Departments</th>
                <th className="text-right px-4 py-3 font-semibold w-28" style={{ color: "var(--text-secondary)" }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {users.map((user) => {
                const isEditing = editingUid === user.uid;
                const isSelf = user.uid === currentUser?.uid;
                const userDepts = user.departments || (user.department ? [user.department as Department] : []);

                return (
                  <tr
                    key={user.uid}
                    className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={isEditing ? { background: "var(--bg-elevated)" } : {}}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={user.name} uid={user.uid} size="sm" />
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {user.name}
                        </span>
                        {isSelf && (
                          <span
                            className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                          >
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                      {user.email}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          id={`role-select-${user.uid}`}
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as AppRole)}
                          className="px-2 py-1 rounded-md text-sm focus:outline-none focus:ring-2"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={roleStyle(user.role)}
                        >
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-[200px]">
                      {isEditing ? (
                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                          {DEPARTMENTS.map((d) => (
                            <label key={d} className="flex items-center gap-2 text-xs">
                              <input 
                                type="checkbox" 
                                checked={editDepts.includes(d)}
                                onChange={() => toggleDept(d)}
                              />
                              {DEPARTMENT_LABELS[d]}
                            </label>
                          ))}
                        </div>
                      ) : userDepts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {userDepts.map(d => (
                            <span key={d} className="text-xs font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10" style={{ color: "var(--text-primary)" }}>
                              {DEPARTMENT_LABELS[d] ?? d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                          Not set
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right align-top">
                      {isEditing ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-2.5 py-1 text-xs font-medium rounded-md hover:opacity-80 transition-opacity disabled:opacity-50"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(user.uid)}
                            disabled={saving}
                            className="px-2.5 py-1 text-xs font-medium text-white rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: "var(--accent)" }}
                          >
                            {saving ? "…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="text-xs font-medium transition-opacity hover:opacity-80"
                          style={{ color: "var(--accent-text)" }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="rounded-lg px-4 py-4 space-y-3"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)" }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Role Definitions
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <div>
            <dt className="font-semibold inline" style={{ color: "var(--text-primary)" }}>Lead Pastor</dt>
            <dd className="inline"> — Full access + user management</dd>
          </div>
          <div>
            <dt className="font-semibold inline" style={{ color: "var(--text-primary)" }}>Pastor</dt>
            <dd className="inline"> — All reports, all tasks, roster editing</dd>
          </div>
          <div>
            <dt className="font-semibold inline" style={{ color: "var(--text-primary)" }}>Devotion Lead</dt>
            <dd className="inline"> — Devotion schedule editing + standard access</dd>
          </div>
          <div>
            <dt className="font-semibold inline" style={{ color: "var(--text-primary)" }}>Worker</dt>
            <dd className="inline"> — Own reports, own tasks, feedback</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

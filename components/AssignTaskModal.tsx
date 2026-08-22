"use client";

import { useState, useEffect, FormEvent } from "react";
import { collection, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { UserProfile } from "@/types";
import { useToast } from "@/context/ToastContext";
import { Skeleton } from "@/components/Skeleton";

interface AssignTaskModalProps {
  assignedByUid: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignTaskModal({
  assignedByUid,
  onClose,
  onAssigned,
}: AssignTaskModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [assignedTo, setAssignedTo] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const { success, error } = useToast();

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then((snap) => {
        const list = snap.docs.map(
          (d) => ({ uid: d.id, ...d.data() } as UserProfile)
        );
        setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
        if (list.length > 0) setAssignedTo(list[0].uid);
      })
      .catch(() => error("Could not load users."))
      .finally(() => setLoadingUsers(false));
  }, [error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assignedTo || !description.trim() || !deadline) return;

    setSubmitting(true);

    try {
      const deadlineDate = new Date(deadline);
      deadlineDate.setHours(23, 59, 59, 0);

      await addDoc(collection(db, "tasks"), {
        assigned_to: assignedTo,
        assigned_by: assignedByUid,
        description: description.trim(),
        status: "ASSIGNED",
        deadline: Timestamp.fromDate(deadlineDate),
        created_at: serverTimestamp(),
      });

      const assignee = users.find((u) => u.uid === assignedTo);
      if (assignee && assignee.email) {
        fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: assignee.email,
            subject: "New Task Assigned in Church OS",
            html: `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>${description.trim()}</strong></p><p>Deadline: ${deadlineDate.toLocaleDateString()}</p><p>Log in to Church OS to view your tasks.</p>`,
          }),
        }).catch(console.error);
      }

      success("Task assigned successfully");
      onAssigned();
      onClose();
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Assign Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="modal-assign-to"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              Assign to
            </label>
            {loadingUsers ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <select
                id="modal-assign-to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} ({u.role.replace(/_/g, " ")})
                    {u.department ? ` — ${u.department.replace(/_/g, " ")}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="modal-description"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              Task description
            </label>
            <textarea
              id="modal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              maxLength={500}
              placeholder="Describe the task clearly…"
              className="w-full px-3 py-2 rounded-md text-sm resize-none focus:outline-none focus:ring-2"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
            <p className="text-right text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {description.length}/500
            </p>
          </div>

          <div>
            <label
              htmlFor="modal-deadline"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              Deadline
            </label>
            <input
              id="modal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={minDate}
              required
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md transition-colors hover:opacity-80"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingUsers}
              className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
              style={{ background: "var(--accent)" }}
            >
              {submitting ? "Assigning…" : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Task, TaskStatus } from "@/types";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/Avatar";
import { Trash2 } from "lucide-react";

const STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const ALL_STATUSES: TaskStatus[] = ["ASSIGNED", "IN_PROGRESS", "COMPLETED"];

interface TaskCardProps {
  task: Task;
  assigneeName: string;
  assignedByName: string;
  isAssignee: boolean;
  canDelete?: boolean;
  onUpdate?: () => void;
}

export function TaskCard({
  task,
  assigneeName,
  assignedByName,
  isAssignee,
  canDelete = false,
  onUpdate,
}: TaskCardProps) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { success, error } = useToast();

  // Handle both client SDK Timestamps and admin SDK Timestamps
  const deadline = task.deadline?.toDate?.()
    ?? ((task.deadline as unknown as { _seconds?: number })?._seconds
      ? new Date((task.deadline as unknown as { _seconds: number })._seconds * 1000)
      : null);
  const isOverdue = deadline && status !== "COMPLETED" && deadline < new Date();

  async function handleStatusChange(next: TaskStatus) {
    if (!task.id || next === status) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "tasks", task.id), { status: next });
      setStatus(next);
      success(`Task marked as ${STATUS_LABELS[next]}`);
      onUpdate?.();
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!task.id) return;
    setUpdating(true);
    try {
      await deleteDoc(doc(db, "tasks", task.id));
      success("Task deleted");
      onUpdate?.();
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setUpdating(false);
      setConfirmDelete(false);
    }
  }

  const statusStyle = (s: TaskStatus) => {
    switch (s) {
      case "ASSIGNED":
        return {
          background: "var(--bg-elevated)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-primary)",
        };
      case "IN_PROGRESS":
        return {
          background: "var(--warning-subtle)",
          color: "var(--warning)",
          border: "1px solid var(--warning)",
        };
      case "COMPLETED":
        return {
          background: "var(--success-subtle)",
          color: "var(--success)",
          border: "1px solid var(--success)",
        };
    }
  };

  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isOverdue ? "var(--danger)" : "var(--border-primary)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-sm font-medium leading-snug flex-1"
          style={{ color: "var(--text-primary)" }}
        >
          {task.description}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-medium px-2.5 py-0.5 rounded-full"
            style={statusStyle(status)}
          >
            {STATUS_LABELS[status]}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded-md transition-colors hover:opacity-80"
              style={{ color: "var(--danger)" }}
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
        <div className="flex items-center gap-2">
          <Avatar name={assigneeName} uid={task.assigned_to} size="sm" />
          <div className="flex flex-col">
            <span style={{ color: "var(--text-muted)" }}>Assigned to</span>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {assigneeName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Avatar name={assignedByName} uid={task.assigned_by} size="sm" />
          <div className="flex flex-col">
            <span style={{ color: "var(--text-muted)" }}>Assigned by</span>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {assignedByName}
            </span>
          </div>
        </div>

        {deadline && (
          <div className="flex flex-col">
            <span style={{ color: "var(--text-muted)" }}>Due</span>
            <span
              className="font-medium"
              style={{
                color: isOverdue ? "var(--danger)" : "var(--text-primary)",
              }}
            >
              {deadline.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {isOverdue && " — Overdue"}
            </span>
          </div>
        )}
      </div>

      {isAssignee && status !== "COMPLETED" && (
        <div
          className="flex items-center gap-2 pt-2"
          style={{ borderTop: "1px solid var(--border-primary)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Update status:
          </span>
          <div className="flex gap-2">
            {ALL_STATUSES.filter((s) => s !== status).map((s) => (
              <button
                key={s}
                type="button"
                disabled={updating}
                onClick={() => handleStatusChange(s)}
                className="text-xs px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md"
          style={{
            background: "var(--danger-subtle)",
            border: "1px solid var(--danger)",
          }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
            Delete this task? This cannot be undone.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={updating}
              className="text-xs px-2.5 py-1 rounded-md"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={updating}
              className="text-xs px-2.5 py-1 rounded-md text-white"
              style={{ background: "var(--danger)" }}
            >
              {updating ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

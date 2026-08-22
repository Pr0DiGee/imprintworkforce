"use client";

import { useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { TaskCard } from "@/components/TaskCard";
import { AssignTaskModal } from "@/components/AssignTaskModal";
import { Task, UserProfile } from "@/types";
import { isPastor as checkPastor } from "@/lib/roles";

const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  ASSIGNED: 1,
  COMPLETED: 2,
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff =
      (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    // Handle admin SDK Timestamp objects (which have _seconds instead of toDate)
    const getTime = (t: Task) => {
      if (t.deadline?.toDate) return t.deadline.toDate().getTime();
      const secs = (t.deadline as unknown as { _seconds?: number })?._seconds;
      if (secs) return secs * 1000;
      return Infinity;
    };
    return getTime(a) - getTime(b);
  });
}

interface TasksClientProps {
  user: UserProfile;
  initialTasks: Task[];
  usersMap: Record<string, { uid: string; name: string }>;
}

export function TasksClient({
  user,
  initialTasks,
  usersMap,
}: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>(sortTasks(initialTasks));
  const [showModal, setShowModal] = useState(false);

  const userIsPastor = checkPastor(user.role);

  // Reload tasks from the client after mutations (create, delete, status change)
  const reloadTasks = useCallback(async () => {
    try {
      let snap;
      if (user.role === "LEAD_PASTOR") {
        snap = await getDocs(
          query(collection(db, "tasks"), orderBy("deadline", "asc"))
        );
      } else if (user.role === "PASTOR") {
        snap = await getDocs(
          query(
            collection(db, "tasks"),
            where("assigned_by", "==", user.uid)
          )
        );
      } else {
        snap = await getDocs(
          query(
            collection(db, "tasks"),
            where("assigned_to", "==", user.uid)
          )
        );
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      setTasks(sortTasks(list));
    } catch (err) {
      console.error("[TasksClient] Failed to reload tasks:", err);
    }
  }, [user]);

  const activeTasks = tasks.filter((t) => t.status !== "COMPLETED");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {user.role === "LEAD_PASTOR"
              ? "Global Tasks"
              : user.role === "PASTOR"
                ? "Assigned Tasks"
                : "My Tasks"}
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {activeTasks.length} active · {completedTasks.length} completed
          </p>
        </div>

        {userIsPastor && (
          <button
            id="assign-task-btn"
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors focus:outline-none focus:ring-2"
            style={{ background: "var(--accent)" }}
          >
            + Assign Task
          </button>
        )}
      </div>

      {activeTasks.length === 0 ? (
        <div
          className="rounded-lg px-5 py-8 text-center border-dashed border-2"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border-primary)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {userIsPastor
              ? 'No active tasks. Use "Assign Task" to create one.'
              : "You have no active tasks right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assigneeName={usersMap[task.assigned_to]?.name ?? task.assigned_to}
              assignedByName={usersMap[task.assigned_by]?.name ?? task.assigned_by}
              isAssignee={task.assigned_to === user.uid}
              canDelete={userIsPastor}
              onUpdate={reloadTasks}
            />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <details className="group">
          <summary
            className="cursor-pointer text-sm font-medium hover:opacity-80 select-none list-none flex items-center gap-2 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="group-open:rotate-90 transition-transform inline-block">
              ▶
            </span>
            Completed ({completedTasks.length})
          </summary>
          <div className="mt-3 space-y-3 opacity-75">
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assigneeName={usersMap[task.assigned_to]?.name ?? task.assigned_to}
                assignedByName={usersMap[task.assigned_by]?.name ?? task.assigned_by}
                isAssignee={task.assigned_to === user.uid}
                canDelete={userIsPastor}
                onUpdate={reloadTasks}
              />
            ))}
          </div>
        </details>
      )}

      {showModal && (
        <AssignTaskModal
          assignedByUid={user.uid}
          onClose={() => setShowModal(false)}
          onAssigned={reloadTasks}
        />
      )}
    </div>
  );
}

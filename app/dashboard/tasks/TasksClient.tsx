"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckSquare, Phone, ArrowRight, X, HeartHandshake, Check } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { AssignTaskModal } from "@/components/AssignTaskModal";
import { EmptyState } from "@/components/EmptyState";
import type { Task, UserProfile } from "@/types";
import type { AutoTodo, CheckupItem } from "@/lib/action-items";
import { can } from "@/lib/permissions";
import { toJsDate } from "@/lib/date";
import { savePersonalTask, setCheckupDone } from "./actions";

const STATUS_ORDER: Record<string, number> = { IN_PROGRESS: 0, ASSIGNED: 1, COMPLETED: 2 };

function sortTasks(tasks: Task[]): Task[] {
  const getTime = (t: Task) => toJsDate(t.deadline)?.getTime() ?? Infinity;
  return [...tasks].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || getTime(a) - getTime(b));
}

const formatDue = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

const cardStyle = (overdue: boolean) => ({
  background: "var(--bg-card)",
  border: `1px solid ${overdue ? "var(--danger)" : "var(--border-primary)"}`,
});

/** Automatic weekly to-do: clears itself once the real thing is done. */
function AutoTodoCard({ todo }: { todo: AutoTodo }) {
  return (
    <Link href={todo.href} className="block rounded-lg p-4 hover:opacity-90 transition-opacity" style={cardStyle(todo.overdue)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{todo.title}</p>
          <p className="text-xs mt-1" style={{ color: todo.overdue ? "var(--danger)" : "var(--text-muted)" }}>
            Due {formatDue(todo.due)}{todo.overdue && " — Overdue"}
          </p>
        </div>
        <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
      </div>
    </Link>
  );
}

function CheckupCard({ item }: { item: CheckupItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const digits = item.targetPhone?.replace(/\D/g, "") ?? "";
  const waNumber = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;

  async function toggle() {
    setBusy(true);
    const res = await setCheckupDone(item.id, !item.completed);
    setBusy(false);
    if ("error" in res) return toast.error(res.error);
    toast.success(item.completed ? "Marked as not done" : `Check-up with ${item.targetName} done`);
    router.refresh();
  }

  return (
    <div className="rounded-lg p-4" style={{ ...cardStyle(item.overdue), opacity: item.completed ? 0.7 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <HeartHandshake size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Check up on {item.targetName}{item.current ? " this week" : ""}
            </p>
            <p className="text-xs mt-1" style={{ color: item.overdue ? "var(--danger)" : "var(--text-muted)" }}>
              {item.completed ? "Done" : `Due ${formatDue(item.due)}${item.overdue ? " — Overdue" : ""}`}
            </p>
            {item.current && !item.completed && (
              item.targetPhone ? (
                <div className="flex gap-2 mt-2">
                  <a href={`tel:${item.targetPhone.replace(/[^0-9+]/g, "")}`} className="text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}>
                    <Phone size={12} /> Call
                  </a>
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ background: "#25D366", color: "#fff" }}>
                    WhatsApp
                  </a>
                </div>
              ) : (
                <p className="text-xs mt-2 italic" style={{ color: "var(--text-muted)" }}>{item.targetName} hasn&apos;t added a phone number yet.</p>
              )
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1 disabled:opacity-60 shrink-0"
          style={item.completed ? { background: "var(--bg-input)", color: "var(--text-secondary)" } : { background: "var(--accent)", color: "#fff" }}
        >
          {item.completed ? "Undo" : <><Check size={12} /> Done</>}
        </button>
      </div>
    </div>
  );
}

export function PersonalTaskModal({ task, onClose }: { task?: Task; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultDue] = useState(() =>
    (toJsDate(task?.deadline) ?? new Date(Date.now() + 864e5)).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await savePersonalTask(task?.id ?? null, String(form.get("description")), String(form.get("deadline")));
    setBusy(false);
    if ("error" in res) return setError(res.error);
    toast.success(task ? "Task updated" : "Task added");
    onClose();
    router.refresh();
  }

  const field = "w-full px-3 py-2 rounded-md border text-sm";
  const fieldStyle = { background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };
  return (
    <div role="dialog" aria-modal="true" aria-label="Personal task" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl shadow-xl p-5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{task ? "Edit personal task" : "New personal task"}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Only you can see your personal tasks.</p>
        <textarea name="description" required autoFocus defaultValue={task?.description} rows={3} placeholder="What do you need to do?" className={field} style={fieldStyle} />
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Deadline</label>
          <input name="deadline" type="date" required defaultValue={defaultDue} className={field} style={fieldStyle} />
        </div>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-60" style={{ background: "var(--accent)" }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{children}</h3>;
}

interface TasksClientProps {
  user: UserProfile;
  tasks: Task[];
  usersMap: Record<string, { uid: string; name: string }>;
  autoTodos: AutoTodo[];
  checkups: CheckupItem[];
}

export function TasksClient({ user, tasks, usersMap, autoTodos, checkups }: TasksClientProps) {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [personalModal, setPersonalModal] = useState<{ task?: Task } | null>(null);
  const canAssign = can(user, "assignTasks");
  const seesAllTasks = can(user, "viewAllTasks");
  const refresh = () => router.refresh();

  const sorted = sortTasks(tasks);
  const activeTasks = sorted.filter((t) => t.status !== "COMPLETED");
  const completedTasks = sorted.filter((t) => t.status === "COMPLETED");
  const openCheckups = checkups.filter((c) => !c.completed);
  const nothingToDo = autoTodos.length === 0 && openCheckups.length === 0 && activeTasks.length === 0;

  const card = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      assigneeName={usersMap[task.assigned_to]?.name ?? task.assigned_to}
      assignedByName={task.personal ? "You (personal)" : usersMap[task.assigned_by]?.name ?? task.assigned_by}
      isAssignee={task.assigned_to === user.uid}
      canDelete={task.personal ? task.assigned_to === user.uid : canAssign}
      onEdit={task.personal && task.assigned_to === user.uid ? () => setPersonalModal({ task }) : undefined}
      onUpdate={refresh}
    />
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{seesAllTasks ? "All Tasks" : "My Tasks"}</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {activeTasks.length + autoTodos.length + openCheckups.length} to do · {completedTasks.length} completed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPersonalModal({})}
            className="px-3 py-2 text-sm font-medium rounded-md"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
          >
            + Personal task
          </button>
          {canAssign && (
            <button
              id="assign-task-btn"
              type="button"
              onClick={() => setShowAssign(true)}
              className="px-3 py-2 text-sm font-medium text-white rounded-md"
              style={{ background: "var(--accent)" }}
            >
              + Assign Task
            </button>
          )}
        </div>
      </div>

      {(autoTodos.length > 0 || checkups.length > 0) && (
        <section className="space-y-3">
          <SectionTitle>This week</SectionTitle>
          {autoTodos.map((t) => <AutoTodoCard key={t.id} todo={t} />)}
          {checkups.map((c) => <CheckupCard key={c.id} item={c} />)}
        </section>
      )}

      {nothingToDo ? (
        <EmptyState
          icon={CheckSquare}
          title="You're all caught up!"
          description={canAssign ? "No active tasks. Use 'Assign Task' to delegate work to your team." : "You have no active tasks right now. Enjoy your day!"}
          actionLabel={canAssign ? "Assign Task" : undefined}
          onAction={canAssign ? () => setShowAssign(true) : undefined}
        />
      ) : (
        activeTasks.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Tasks</SectionTitle>
            {activeTasks.map(card)}
          </section>
        )
      )}

      {completedTasks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium hover:opacity-80 select-none list-none flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Completed ({completedTasks.length})
          </summary>
          <div className="mt-3 space-y-3 opacity-75">{completedTasks.map(card)}</div>
        </details>
      )}

      {showAssign && <AssignTaskModal assignedByUid={user.uid} onClose={() => setShowAssign(false)} onAssigned={refresh} />}
      {personalModal && <PersonalTaskModal task={personalModal.task} onClose={() => setPersonalModal(null)} />}
    </div>
  );
}

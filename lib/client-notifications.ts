/**
 * Something the current user just did that may notify someone else.
 * The server loads the record, checks the caller was allowed to do it,
 * and decides the recipient and message — see /api/notifications/send.
 */
export type PushEvent =
  | { type: "TASK_ASSIGNED"; taskId: string }
  | { type: "TASK_COMPLETED"; taskId: string };

export async function notifyEvent(event: PushEvent): Promise<void> {
  try {
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn("[Push] Client trigger push error:", err);
  }
}

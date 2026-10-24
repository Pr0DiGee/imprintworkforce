import { NextRequest, NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getServerUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendPushNotification } from "@/lib/push-notifications";
import { can } from "@/lib/permissions";
import type { PushEvent } from "@/lib/client-notifications";

// Event-based push: the client reports what it just did, and the server loads
// the record, checks the caller was allowed to do it, and decides the
// recipient and wording itself. Clients can never choose recipients or text.

interface ResolvedPush {
  /** Unique id for this notification; a second send with the same key is skipped */
  key: string;
  uid: string;
  title: string;
  body: string;
  url: string;
}

class Rejected extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}


function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

async function resolveEvent(
  event: PushEvent,
  caller: { uid: string; name: string; role: string; departments?: string[] }
): Promise<ResolvedPush> {
  const db = getAdminDb();

  switch (event.type) {
    case "TASK_ASSIGNED":
    case "TASK_COMPLETED": {
      if (typeof event.taskId !== "string" || !event.taskId || event.taskId.includes("/")) {
        throw new Rejected("Invalid task id", 400);
      }
      const snap = await db.collection("tasks").doc(event.taskId).get();
      if (!snap.exists) throw new Rejected("Task not found", 404);
      const task = snap.data()!;

      if (event.type === "TASK_ASSIGNED") {
        if (!can(caller, "assignTasks") || task.assigned_by !== caller.uid) {
          throw new Rejected("You did not assign this task");
        }
        const due = task.deadline ? ` (Due: ${formatDate((task.deadline as Timestamp).toDate())})` : "";
        return {
          key: `TASK_ASSIGNED_${snap.id}`,
          uid: task.assigned_to,
          title: "New Task Assigned",
          body: `"${task.description}"${due}`,
          url: "/dashboard/tasks",
        };
      }

      if (task.assigned_to !== caller.uid || task.status !== "COMPLETED") {
        throw new Rejected("You have not completed this task");
      }
      return {
        key: `TASK_COMPLETED_${snap.id}`,
        uid: task.assigned_by,
        title: "Task Completed",
        body: `${caller.name} completed "${task.description}"`,
        url: "/dashboard/tasks",
      };
    }

    default:
      throw new Rejected("Unknown event", 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = (await request.json()) as PushEvent;
    if (!event || typeof event !== "object" || typeof event.type !== "string") {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    const push = await resolveEvent(event, user);

    // Nobody needs a notification about their own action
    if (!push.uid || push.uid === user.uid) {
      return NextResponse.json({ ok: true, skipped: "self" });
    }

    // Claim the key atomically; create() fails if this notification was already sent
    try {
      await getAdminDb().collection("push_events").doc(push.key).create({
        type: event.type,
        triggered_by: user.uid,
        recipient: push.uid,
        sent_at: FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 6) {
        return NextResponse.json({ ok: true, skipped: "duplicate" });
      }
      throw err;
    }

    const result = await sendPushNotification({
      type: event.type,
      triggeredBy: user.uid,
      uids: [push.uid],
      title: push.title,
      body: push.body,
      url: push.url,
    });

    return NextResponse.json({ ok: true, sent: result.success, failed: result.failed });
  } catch (error: unknown) {
    if (error instanceof Rejected) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/notifications/send] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

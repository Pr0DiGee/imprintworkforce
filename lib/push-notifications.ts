import webpush from "web-push";
import { getAdminDb } from "@/lib/firebase/admin";

let isVapidConfigured = false;

function ensureVapidConfig() {
  if (isVapidConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:imprintglobalministry@gmail.com";

  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys are missing from environment variables.");
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isVapidConfigured = true;
}

// Notification types live in ./push-types (browser-safe); re-exported here.
import { AUTOMATIC_PUSH_TYPES, PUSH_TYPE_LABELS, type AutomaticPushType, type DeliveryStatus, type PushType } from "@/lib/push-types";
export { AUTOMATIC_PUSH_TYPES, PUSH_TYPE_LABELS };
export type { AutomaticPushType, DeliveryStatus, PushType };

export async function getDisabledPushTypes(): Promise<Partial<Record<AutomaticPushType, boolean>>> {
  const snap = await getAdminDb().collection("settings").doc("notifications").get();
  return (snap.data()?.disabled as Partial<Record<AutomaticPushType, boolean>>) ?? {};
}

// ─── Sending ────────────────────────────────────────────────────────────────

export interface PushPayload {
  type: PushType;
  uids: string[];
  title: string;
  body: string;
  url?: string;
  /** Custom pushes: the custom_pushes doc this send belongs to */
  customId?: string;
  /** Who triggered it (uid), when a person did */
  triggeredBy?: string;
  /** Admin re-send: deliver even if this automatic type is switched off */
  force?: boolean;
  /** push_log id this send is a re-send of */
  resendOf?: string;
}

export interface PushResult {
  success: number;
  failed: number;
  skipped?: "disabled";
  delivery: Record<string, DeliveryStatus>;
  logId?: string;
}

/**
 * Send a push to the given users' devices and record it in `push_log`
 * (who, what, and per-person delivery) for the admin Notifications page.
 * Automatic types that an admin has switched off are not sent.
 */
export async function sendPushNotification({
  type,
  uids,
  title,
  body,
  url = "/dashboard",
  customId,
  triggeredBy,
  force = false,
  resendOf,
}: PushPayload): Promise<PushResult> {
  ensureVapidConfig();

  const validUids = Array.from(new Set((uids ?? []).filter(Boolean)));
  if (validUids.length === 0) return { success: 0, failed: 0, delivery: {} };

  if (!force && type !== "CUSTOM" && (await getDisabledPushTypes())[type]) {
    return { success: 0, failed: 0, skipped: "disabled", delivery: {} };
  }

  const db = getAdminDb();
  const delivery: Record<string, DeliveryStatus> = Object.fromEntries(validUids.map((u) => [u, "no_device" as DeliveryStatus]));
  let successCount = 0;
  let failCount = 0;
  const payload = JSON.stringify({ title, body, url, icon: "/icon-192.png", badge: "/icon-192.png" });

  try {
    // Firestore "in" queries accept up to 30 items
    for (let i = 0; i < validUids.length; i += 30) {
      const chunk = validUids.slice(i, i + 30);
      const snap = await db.collection("push_subscriptions").where("uid", "in", chunk).get();
      if (snap.empty) continue;

      const deleteBatch = db.batch();
      let deleteCount = 0;

      await Promise.all(
        snap.docs.map(async (docSnap) => {
          const sub = docSnap.data();
          if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
            deleteBatch.delete(docSnap.ref);
            deleteCount++;
            return;
          }
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, payload);
            successCount++;
            delivery[sub.uid] = "sent";
          } catch (err: unknown) {
            failCount++;
            if (delivery[sub.uid] !== "sent") delivery[sub.uid] = "failed";
            const statusCode = (err as { statusCode?: number })?.statusCode;
            // Expired or invalid subscription (404 / 410 Gone): remove it
            if (statusCode === 404 || statusCode === 410) {
              deleteBatch.delete(docSnap.ref);
              deleteCount++;
            } else {
              console.error("[Push] Delivery failure:", (err as Error)?.message || err);
            }
          }
        })
      );

      if (deleteCount > 0) await deleteBatch.commit();
    }
  } catch (error) {
    console.error("[Push] Error sending notifications:", error);
  }

  let logId: string | undefined;
  try {
    const ref = await db.collection("push_log").add({
      type,
      title,
      body,
      url,
      recipients: validUids,
      delivery,
      sent_count: Object.values(delivery).filter((s) => s === "sent").length,
      failed_count: Object.values(delivery).filter((s) => s === "failed").length,
      no_device_count: Object.values(delivery).filter((s) => s === "no_device").length,
      custom_id: customId ?? null,
      resend_of: resendOf ?? null,
      triggered_by: triggeredBy ?? null,
      created_at: new Date(),
    });
    logId = ref.id;
  } catch (error) {
    console.error("[Push] Could not write push_log:", error);
  }

  return { success: successCount, failed: failCount, delivery, logId };
}

/**
 * Claim a one-time key for a notification (server-only `push_events`).
 * Returns false if it was already claimed, so callers can skip re-sending:
 * a retried or re-run job never pings anyone twice.
 */
export async function claimPushKey(key: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    await getAdminDb().collection("push_events").doc(key).create({ ...data, sent_at: new Date() });
    return true;
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 6) return false;
    throw err;
  }
}

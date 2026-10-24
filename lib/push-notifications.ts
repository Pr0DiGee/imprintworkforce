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

export interface PushPayload {
  uids: string[];
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification({
  uids,
  title,
  body,
  url = "/dashboard",
}: PushPayload): Promise<{ success: number; failed: number }> {
  ensureVapidConfig();

  if (!uids || uids.length === 0) {
    return { success: 0, failed: 0 };
  }

  // Filter out any blank or invalid UIDs
  const validUids = Array.from(new Set(uids.filter(Boolean)));
  if (validUids.length === 0) {
    return { success: 0, failed: 0 };
  }

  const db = getAdminDb();
  let successCount = 0;
  let failCount = 0;

  try {
    // Firestore "in" queries accept up to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < validUids.length; i += 30) {
      chunks.push(validUids.slice(i, i + 30));
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });

    for (const chunk of chunks) {
      const snap = await db
        .collection("push_subscriptions")
        .where("uid", "in", chunk)
        .get();

      if (snap.empty) continue;

      const deleteBatch = db.batch();
      let deleteCount = 0;

      await Promise.all(
        snap.docs.map(async (docSnap) => {
          const subData = docSnap.data();
          if (!subData.endpoint || !subData.keys?.p256dh || !subData.keys?.auth) {
            deleteBatch.delete(docSnap.ref);
            deleteCount++;
            return;
          }

          const subscription: webpush.PushSubscription = {
            endpoint: subData.endpoint,
            keys: {
              p256dh: subData.keys.p256dh,
              auth: subData.keys.auth,
            },
          };

          try {
            await webpush.sendNotification(subscription, payload);
            successCount++;
          } catch (err: any) {
            failCount++;
            // If subscription has expired or is invalid (404 / 410 Gone), delete it
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              deleteBatch.delete(docSnap.ref);
              deleteCount++;
            } else {
              console.error("[Push] Delivery failure:", err?.message || err);
            }
          }
        })
      );

      if (deleteCount > 0) {
        await deleteBatch.commit();
      }
    }
  } catch (error) {
    console.error("[Push] Error sending notifications:", error);
  }

  return { success: successCount, failed: failCount };
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

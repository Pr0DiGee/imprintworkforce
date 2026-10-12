export async function triggerPushNotification({
  uids,
  title,
  body,
  url = "/dashboard",
}: {
  uids: string[];
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  if (!uids || uids.length === 0) return;

  try {
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uids,
        title,
        body,
        url,
      }),
    });
  } catch (err) {
    console.warn("[Push] Client trigger push error:", err);
  }
}

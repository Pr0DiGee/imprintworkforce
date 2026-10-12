"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPermissionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Only run on client with push notification support
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // If permission is default (not yet granted or denied), prompt the user
    if (Notification.permission === "default") {
      setShowBanner(true);
    } else if (Notification.permission === "granted") {
      // Ensure current device subscription is synced with Firestore
      syncSubscription();
    }
  }, []);

  async function syncSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch (err) {
      console.warn("[Push] Subscription sync error:", err);
    }
  }

  async function handleEnable() {
    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        await syncSubscription();
        toast.success("Notifications enabled successfully!");
        setShowBanner(false);
      } else if (permission === "denied") {
        toast.info("Notifications were denied. You can enable them anytime in browser/device settings.");
        setShowBanner(false);
      }
    } catch (err: any) {
      console.error("[Push] Request permission failed:", err);
      toast.error("Failed to enable notifications.");
    } finally {
      setRequesting(false);
    }
  }

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Notification permission prompt"
      className="mb-5 p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 transition-all duration-200 no-print"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-primary)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: "var(--accent-subtle)",
            color: "var(--accent)",
          }}
        >
          <Bell size={18} strokeWidth={2.5} />
        </div>
        <div>
          <h4
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            Enable Push Notifications
          </h4>
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Get instant alerts for devotion assignments, Sunday roster duties, and task updates on this device.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors hover:opacity-80"
          style={{
            color: "var(--text-secondary)",
          }}
        >
          Later
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={requesting}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white transition-opacity disabled:opacity-50"
          style={{
            background: "var(--accent)",
          }}
        >
          {requesting ? "Enabling…" : "Enable"}
        </button>
      </div>
    </div>
  );
}

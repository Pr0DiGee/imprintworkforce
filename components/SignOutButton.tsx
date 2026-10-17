"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useState } from "react";

/** This device's push subscription endpoint, if any (gives up after 2s). */
async function currentPushEndpoint(): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const lookup = navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub) => sub?.endpoint ?? null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
  return Promise.race([lookup, timeout]).catch(() => null);
}

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // 1. Stop this user's notifications going to this device (needs the session, so first)
      const endpoint = await currentPushEndpoint();
      if (endpoint) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      // 2. Sign out of Firebase Auth on the client
      await signOut(auth);
      // 3. Clear the httpOnly session cookie on the server
      await fetch("/api/auth/session", { method: "DELETE" });
      // 4. Redirect to login
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("[SignOutButton] Sign-out failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      id="signout-btn"
      onClick={handleSignOut}
      disabled={loading}
      className="w-full text-left px-0 py-1 text-xs font-medium disabled:opacity-50 transition-colors focus:outline-none"
      style={{ color: "var(--danger)" }}
    >
      {loading ? "Signing out…" : "Sign Out"}
    </button>
  );
}

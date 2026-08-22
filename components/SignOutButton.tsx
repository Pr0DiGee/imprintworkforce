"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // 1. Sign out of Firebase Auth on the client
      await signOut(auth);
      // 2. Clear the httpOnly session cookie on the server
      await fetch("/api/auth/session", { method: "DELETE" });
      // 3. Redirect to login
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

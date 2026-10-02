"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const oobCode = searchParams.get("oobCode");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!oobCode) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 dark:bg-red-900/20 dark:text-red-500">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Invalid Link</h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          The password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="w-full inline-block py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors text-center"
          style={{ background: "var(--accent)" }}
        >
          Request New Link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // Optional: you could verify the code first, but confirmPasswordReset will fail if it's invalid anyway
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setSuccess(true);
    } catch (err: any) {
      if (err.code === "auth/invalid-action-code") {
        setError("This reset link has expired or already been used.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use at least 6 characters.");
      } else {
        setError("Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 dark:bg-emerald-900/20 dark:text-emerald-500">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Password Reset!</h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Your password has been successfully updated.
        </p>
        <Link
          href="/login"
          className="w-full inline-block py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors text-center"
          style={{ background: "var(--accent)" }}
        >
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          New Password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
          placeholder="Enter new password"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm px-4 py-3 rounded-lg" style={{ background: "var(--danger-subtle)", color: "var(--danger)", border: "1px solid var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !newPassword}
        className="w-full py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
        style={{ background: "var(--accent)" }}
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: "var(--bg-page)" }}>
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: "var(--accent)" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: "var(--accent)" }} />
      
      <div 
        className="w-full max-w-md p-8 rounded-2xl shadow-xl z-10"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
      >
        <Link 
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={16} /> Back to Login
        </Link>
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Create New Password</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Please enter your new password below.
          </p>
        </div>

        <Suspense fallback={<div className="text-sm text-center py-4 text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}

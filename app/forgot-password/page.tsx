"use client";

import { useState, FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: "var(--bg-page)" }}>
      {/* Decorative background blobs (similar to login) */}
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
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Reset Password</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 dark:bg-emerald-900/20 dark:text-emerald-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Check your email</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <Link
              href="/login"
              className="w-full inline-block py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors text-center"
              style={{ background: "var(--accent)" }}
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm px-4 py-3 rounded-lg" style={{ background: "var(--danger-subtle)", color: "var(--danger)", border: "1px solid var(--danger)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

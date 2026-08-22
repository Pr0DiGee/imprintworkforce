"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to create session");
  }
}

function getErrorMessage(err: unknown): string {
  const AUTH_MESSAGES: Record<string, string> = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/operation-not-allowed":
      "Email/Password sign-in is not enabled. Enable it in Firebase Console.",
  };

  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code && AUTH_MESSAGES[e.code]) return AUTH_MESSAGES[e.code];
    if (e.code === "permission-denied")
      return "Database write was blocked. Check your Firestore security rules.";
    if (e.message) return e.message;
  }

  return "An unexpected error occurred. Please try again.";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await createSession(idToken);
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Email
        </label>
        <input
          id="login-email"
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
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm px-4 py-3 rounded-lg" style={{ background: "var(--danger-subtle)", color: "var(--danger)", border: "1px solid var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        id="login-submit"
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
        style={{ background: "var(--accent)" }}
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = credential.user;

      try {
        await setDoc(doc(db, "users", uid), {
          uid,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: "WORKER",
          department: "",
          created_at: serverTimestamp(),
        });
      } catch (firestoreErr: unknown) {
        console.error("[SignUp] Firestore profile write failed:", firestoreErr);
        setError(getErrorMessage(firestoreErr));
        setLoading(false);
        return;
      }

      const idToken = await credential.user.getIdToken();
      await createSession(idToken);

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-name" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Full Name
        </label>
        <input
          id="signup-name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
          placeholder="John Doe"
        />
      </div>
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Email
        </label>
        <input
          id="signup-email"
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
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
          placeholder="At least 6 characters"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm px-4 py-3 rounded-lg" style={{ background: "var(--danger-subtle)", color: "var(--danger)", border: "1px solid var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        id="signup-submit"
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70 mt-2"
        style={{ background: "var(--accent)" }}
      >
        {loading ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "login" | "signup";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>("login");

  // Allow setting light/dark mode explicitly for the split screen design
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen flex flex-col md:flex-row w-full bg-[var(--bg-body)]">
      {/* Left split screen - Branding */}
      <div 
        className="hidden md:flex md:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ 
          background: isDark ? "linear-gradient(135deg, #1e1e1e 0%, #121212 100%)" : "linear-gradient(135deg, #f0f7ff 0%, #e0efff 100%)",
          color: isDark ? "#ffffff" : "#0f172a"
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: "var(--accent)", color: "white" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Church Resource Planning</h1>
          <p className="text-lg opacity-80 max-w-md leading-relaxed">
            A unified platform for managing reports, tasks, devotions, and service feedback.
          </p>
        </div>
        
        <div className="relative z-10 text-sm font-medium opacity-60">
          © {new Date().getFullYear()} Church Admin Portal.
        </div>
      </div>

      {/* Right split screen - Forms */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative min-h-screen md:min-h-0">
        
        {/* Mobile Branding */}
        <div className="md:hidden absolute top-8 left-8 right-8 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--accent)", color: "white" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Church Resource Planning</h1>
        </div>

        <div className="w-full max-w-md pt-20 md:pt-0">
          <div 
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{ 
              background: "var(--bg-card)", 
              border: "1px solid var(--border-primary)",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
            }}
          >
            {/* Tabs */}
            <div className="flex relative" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <button
                id="tab-login"
                onClick={() => setActiveTab("login")}
                className="flex-1 py-4 text-sm font-semibold transition-colors focus:outline-none z-10"
                style={{
                  color: activeTab === "login" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Sign In
              </button>
              <button
                id="tab-signup"
                onClick={() => setActiveTab("signup")}
                className="flex-1 py-4 text-sm font-semibold transition-colors focus:outline-none z-10"
                style={{
                  color: activeTab === "signup" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                Create Account
              </button>
              {/* Tab indicator */}
              <div 
                className="absolute bottom-0 h-0.5 transition-all duration-300 ease-in-out" 
                style={{ 
                  background: "var(--accent)", 
                  width: "50%", 
                  left: activeTab === "login" ? "0" : "50%" 
                }} 
              />
            </div>

            {/* Form area */}
            <div className="p-8">
              {activeTab === "login" ? <LoginForm /> : <SignUpForm />}
            </div>
          </div>

          <p className="text-center text-xs mt-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            New accounts are assigned the <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Worker</span> role by default.
            <br />Contact your administrator to update your role.
          </p>
        </div>
      </div>
    </main>
  );
}

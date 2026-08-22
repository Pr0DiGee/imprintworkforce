"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { UserProfile } from "@/types";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Raw Firebase Auth user (null when signed out) */
  user: User | null;
  /** Firestore user document (includes role + department) */
  userProfile: UserProfile | null;
  /** True while the initial auth state is being resolved */
  loading: boolean;
  /** Re-fetch the Firestore profile (e.g. after admin changes role) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (snap.exists()) {
        setUserProfile({ uid: firebaseUser.uid, ...snap.data() } as UserProfile);
      } else {
        // Document may not exist yet (e.g. race condition during sign-up)
        setUserProfile(null);
      }
    } catch (err) {
      console.error("[AuthContext] Failed to fetch user profile:", err);
      setUserProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  // Periodic soft refresh every 5 minutes to pick up role changes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchProfile(user);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

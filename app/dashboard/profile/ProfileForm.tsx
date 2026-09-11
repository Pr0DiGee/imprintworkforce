"use client";

import { useState, useRef } from "react";
import { UserProfile, DEPARTMENT_LABELS } from "@/types";
import { updateProfile } from "./actions";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase/client";
import { updatePassword, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

export function ProfileForm({ user }: { user: UserProfile }) {
  const { refreshProfile } = useAuth();
  
  // Profile State
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(user.name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.photo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security State
  const [secMode, setSecMode] = useState<"none" | "email" | "password">("none");
  const [secCurrentPassword, setSecCurrentPassword] = useState("");
  const [secNewPassword, setSecNewPassword] = useState("");
  const [secConfirmPassword, setSecConfirmPassword] = useState("");
  const [secNewEmail, setSecNewEmail] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setSuccess(false);
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProfile(formData);

      if (result?.error) {
        setError(result.error);
      } else {
        await refreshProfile();
        setSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSecuritySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setSecLoading(true);
    setSecError(null);
    setSecSuccess(null);

    const isEmailChange = secMode === "email";
    const isPasswordChange = secMode === "password";

    if (isPasswordChange && secNewPassword !== secConfirmPassword) {
      setSecError("New passwords do not match.");
      setSecLoading(false);
      return;
    }

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, secCurrentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // 2. Update Email if requested
      if (isEmailChange) {
        await verifyBeforeUpdateEmail(auth.currentUser, secNewEmail);
      }

      // 3. Update Password if requested
      if (isPasswordChange) {
        await updatePassword(auth.currentUser, secNewPassword);
      }

      setSecSuccess(isEmailChange 
        ? "A verification link has been sent to your new email. Please click it to confirm the change." 
        : "Password updated successfully.");
      setSecCurrentPassword("");
      setSecNewPassword("");
      setSecConfirmPassword("");
      setSecNewEmail("");
      setSecMode("none");
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setSecError("Incorrect current password.");
      } else if (err.code === "auth/email-already-in-use") {
        setSecError("That email is already in use by another account.");
      } else {
        setSecError(err.message || "Failed to update security settings.");
      }
    } finally {
      setSecLoading(false);
    }
  }

  return (
    <div className="space-y-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Profile Picture Section */}
        <div className="flex flex-col md:flex-row items-center gap-6 pb-6" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <div className="relative group">
            {previewUrl ? (
              <img src={previewUrl} alt="Profile preview" className="w-24 h-24 rounded-full object-cover shadow-sm border border-[var(--border-primary)]" />
            ) : (
              <Avatar name={user.name} uid={user.uid} size="lg" />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium"
            >
              Change
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>Profile Picture</h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>JPG, GIF or PNG. Max size of 5MB.</p>
            <input
              type="file"
              name="image"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border"
              style={{ 
                background: "var(--bg-page)", 
                borderColor: "var(--border-primary)",
                color: "var(--text-primary)" 
              }}
            >
              Upload Photo
            </button>
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
              Full Name
            </label>
            <input
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSuccess(false);
              }}
              className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* Role & Dept Section (Read-only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
              Role
            </label>
            <div className="px-4 py-2.5 rounded-lg text-sm bg-[var(--bg-muted)] border border-[var(--border-primary)] text-[var(--text-secondary)] capitalize">
              {user.role === "DEVOTION_LEAD" ? "Devotion Team" : user.role.replace("_", " ").toLowerCase()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
              Departments
            </label>
            <div className="px-4 py-2.5 rounded-lg text-sm bg-[var(--bg-muted)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
              {user.departments?.length > 0
                ? user.departments.map(d => DEPARTMENT_LABELS[d] || d).join(", ")
                : "No departments assigned"}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm px-4 py-3 rounded-lg bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm px-4 py-3 rounded-lg bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]">
            Profile updated successfully!
          </p>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-6 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70 shadow-sm hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Security Settings Form */}
      <div className="pt-8" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Security Settings</h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Update your email address or password. You must provide your current password to make security changes.
        </p>

        {secMode === "none" && (
          <div className="flex gap-4">
            <button
              onClick={() => { setSecMode("email"); setSecSuccess(null); setSecError(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ background: "var(--bg-page)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            >
              Update Email
            </button>
            <button
              onClick={() => { setSecMode("password"); setSecSuccess(null); setSecError(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ background: "var(--bg-page)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            >
              Update Password
            </button>
          </div>
        )}

        {secSuccess && secMode === "none" && (
          <p className="text-sm px-4 py-3 mt-4 max-w-md rounded-lg bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]">
            {secSuccess}
          </p>
        )}

        {secMode !== "none" && (
          <form onSubmit={handleSecuritySubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                Current Password <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                required
                value={secCurrentPassword}
                onChange={(e) => {
                  setSecCurrentPassword(e.target.value);
                  setSecSuccess(null);
                  setSecError(null);
                }}
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
                placeholder="Enter current password"
              />
            </div>

            {secMode === "email" && (
              <div className="pt-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                  New Email Address <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={secNewEmail}
                  onChange={(e) => {
                    setSecNewEmail(e.target.value);
                    setSecSuccess(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}

            {secMode === "password" && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                    New Password <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={secNewPassword}
                    onChange={(e) => {
                      setSecNewPassword(e.target.value);
                      setSecSuccess(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
                    Confirm Password <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={secConfirmPassword}
                    onChange={(e) => {
                      setSecConfirmPassword(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
            )}

            {secError && (
              <p className="text-sm px-4 py-3 mt-4 rounded-lg bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]">
                {secError}
              </p>
            )}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSecMode("none");
                  setSecCurrentPassword("");
                  setSecNewPassword("");
                  setSecConfirmPassword("");
                  setSecNewEmail("");
                  setSecError(null);
                }}
                className="px-4 py-2.5 text-sm font-medium rounded-lg"
                disabled={secLoading}
                style={{ color: "var(--text-primary)", background: "var(--bg-page)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={secLoading || !secCurrentPassword || (secMode === "email" && !secNewEmail) || (secMode === "password" && !secNewPassword)}
                className="py-2.5 px-6 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-70 shadow-sm hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                {secLoading ? "Updating..." : `Update ${secMode === "email" ? "Email" : "Password"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


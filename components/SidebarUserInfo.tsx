"use client";

import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";

export function SidebarUserInfo() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <div className="h-16 skeleton rounded-md" />;
  }

  if (!userProfile) return null;

  return (
    <Link href="/dashboard/profile" className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
      <Avatar name={userProfile.name} uid={userProfile.uid} photoUrl={userProfile.photo_url} size="md" />
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
          title={userProfile.name}
        >
          {userProfile.name}
        </p>
        <p
          className="text-xs truncate"
          style={{ color: "var(--text-muted)" }}
          title={userProfile.email}
        >
          {userProfile.email}
        </p>
      </div>
    </Link>
  );
}

import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import type { UserProfile } from "@/types";

export function SidebarUserInfo({ user }: { user: UserProfile }) {
  return (
    <Link href="/dashboard/profile" className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
      <Avatar name={user.name} uid={user.uid} photoUrl={user.photo_url} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }} title={user.name}>
          {user.name}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }} title={user.email}>
          {user.email}
        </p>
      </div>
    </Link>
  );
}

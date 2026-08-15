import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { UserProfile } from "@/types";
import { SignOutButton } from "@/components/SignOutButton";

// Role badge colours
const ROLE_STYLES: Record<string, string> = {
  LEAD_PASTOR: "bg-purple-100 text-purple-800",
  PASTOR: "bg-blue-100 text-blue-800",
  DEVOTION_LEAD: "bg-amber-100 text-amber-800",
  WORKER: "bg-gray-100 text-gray-700",
};

async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    return { uid, ...snap.data() } as UserProfile;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side session check (secondary guard; middleware already blocks most cases)
  const cookieStore = await cookies();
  const uid = cookieStore.get("session")?.value;

  if (!uid) {
    redirect("/login");
  }

  const profile = await getUserProfile(uid);

  const roleBadgeClass =
    ROLE_STYLES[profile?.role ?? "WORKER"] ?? ROLE_STYLES.WORKER;

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* App name */}
        <div className="px-4 py-5 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900 leading-tight">
            Church Resource
            <br />
            Planning
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link
            href="/dashboard"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            id="nav-dashboard"
          >
            Dashboard
          </Link>

          {/* Phase 2+ links — placeholder, disabled */}
          {[
            { label: "Reports", href: "/dashboard/reports" },
            { label: "Tasks", href: "/dashboard/tasks" },
            { label: "Roster", href: "/dashboard/roster" },
            { label: "Devotion Schedule", href: "/dashboard/devotion" },
            { label: "Feedback", href: "/dashboard/feedback" },
          ].map(({ label, href }) => (
            <span
              key={href}
              title="Coming in a future phase"
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed select-none"
            >
              {label}
            </span>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="px-4 py-4 border-t border-gray-200 space-y-2">
          {profile && (
            <>
              <p className="text-xs font-semibold text-gray-900 truncate" title={profile.name}>
                {profile.name}
              </p>
              <p className="text-xs text-gray-500 truncate" title={profile.email}>
                {profile.email}
              </p>
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass}`}
              >
                {profile.role.replace(/_/g, " ")}
              </span>
            </>
          )}
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

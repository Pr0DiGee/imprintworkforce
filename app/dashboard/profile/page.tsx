import { getServerUser } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getServerUser();
  
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Your Profile
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage your account settings and profile picture.
        </p>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 md:p-8 shadow-sm">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}

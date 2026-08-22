import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";

// Secondary auth guard — proxy.ts already handles the primary redirect,
// but this catches any edge cases where a Server Component renders without a cookie.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("session")?.value;

  if (!uid) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}

import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getServerUser } from "@/lib/server-auth";
import { getActionSummary, sidebarDots } from "@/lib/action-items";

// Loads the signed-in profile once per request (getServerUser is cached, so
// the page reuses it) and hands it to the menu, so role-based links are
// right on the first render instead of appearing after a client-side fetch.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const dots = sidebarDots(await getActionSummary(user));
  return <DashboardShell user={user} dots={dots}>{children}</DashboardShell>;
}

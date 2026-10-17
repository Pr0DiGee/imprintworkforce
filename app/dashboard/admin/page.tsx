import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchAllUsers } from "@/lib/server-data";
import { AdminClient } from "./AdminClient";
import { can } from "@/lib/permissions";

export default async function AdminPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  if (!can(user, "manageUsers")) {
    redirect("/dashboard");
  }

  const users = await fetchAllUsers();
  users.sort((a, b) => a.name.localeCompare(b.name));

  return <AdminClient user={user} initialUsers={users} />;
}

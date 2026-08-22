import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchTasks, fetchAllUsers } from "@/lib/server-data";
import { TasksClient } from "./TasksClient";

export default async function TasksPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [tasks, allUsers] = await Promise.all([
    fetchTasks(user),
    fetchAllUsers(),
  ]);

  // Build uid → UserProfile map
  const usersMap: Record<string, { uid: string; name: string }> = {};
  allUsers.forEach((u) => {
    usersMap[u.uid] = { uid: u.uid, name: u.name };
  });

  return (
    <TasksClient
      user={user}
      initialTasks={tasks}
      usersMap={usersMap}
    />
  );
}

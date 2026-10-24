import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchTasks, fetchAllUsers } from "@/lib/server-data";
import { getActionSummary } from "@/lib/action-items";
import { TasksClient } from "./TasksClient";

export default async function TasksPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [tasks, allUsers, summary] = await Promise.all([fetchTasks(user), fetchAllUsers(), getActionSummary(user)]);
  const usersMap = Object.fromEntries(allUsers.map((u) => [u.uid, { uid: u.uid, name: u.name }]));

  return (
    <TasksClient
      user={user}
      tasks={tasks}
      usersMap={usersMap}
      autoTodos={summary.autoTodos}
      checkups={summary.checkups}
    />
  );
}

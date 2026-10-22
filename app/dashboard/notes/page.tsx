import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchNoteFolders, fetchNoteCounts } from "@/lib/server-data";
import { NotesClient } from "./NotesClient";

export default async function NotesPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const folders = await fetchNoteFolders(user.uid);
  const noteCounts = await fetchNoteCounts(user.uid, ["quick-notes", ...folders.map((f) => f.id!)]);

  return (
    <NotesClient
      user={user}
      initialFolders={folders}
      initialNoteCounts={noteCounts}
    />
  );
}

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchNoteFolders, fetchAllNotesForUser } from "@/lib/server-data";
import { NotesClient } from "./NotesClient";

export default async function NotesPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [folders, allNotes] = await Promise.all([
    fetchNoteFolders(user.uid),
    fetchAllNotesForUser(user.uid),
  ]);

  // Build a count map: folderId → number of notes
  const noteCounts: Record<string, number> = {};
  allNotes.forEach((n) => {
    noteCounts[n.folder_id] = (noteCounts[n.folder_id] || 0) + 1;
  });

  return (
    <NotesClient
      user={user}
      initialFolders={folders}
      initialNoteCounts={noteCounts}
    />
  );
}

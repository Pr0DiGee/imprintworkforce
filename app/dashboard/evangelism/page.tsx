import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-auth";
import { fetchEvangelismContacts, fetchUserMap } from "@/lib/server-data";
import { EvangelismClient } from "./EvangelismClient";

export default async function EvangelismPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [contacts, userMap] = await Promise.all([
    fetchEvangelismContacts(),
    fetchUserMap(),
  ]);

  return <EvangelismClient user={user} contacts={contacts} userMap={userMap} />;
}

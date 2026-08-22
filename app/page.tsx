import { redirect } from "next/navigation";

/**
 * Root route — immediately redirects to /dashboard.
 * The proxy (proxy.ts) will then enforce auth and redirect
 * unauthenticated users onward to /login if needed.
 */
export default function RootPage() {
  redirect("/dashboard");
}

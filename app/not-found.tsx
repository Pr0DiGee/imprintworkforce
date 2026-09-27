import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-in fade-in" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--bg-elevated)" }}>
        <FileQuestion className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
      </div>
      <h1 className="text-4xl font-bold mb-3 tracking-tight">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
      <p className="mb-8 max-w-sm" style={{ color: "var(--text-secondary)" }}>
        We couldn't find the page you were looking for. It might have been moved or doesn't exist.
      </p>
      <Link 
        href="/"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow h-10 px-8"
        style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
      >
        Return Home
      </Link>
    </div>
  );
}

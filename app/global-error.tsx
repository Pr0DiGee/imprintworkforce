"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Root Error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-in fade-in" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">A critical error occurred</h1>
          <p className="mb-8 max-w-md" style={{ color: "var(--text-secondary)" }}>
            The application encountered an unexpected failure. Please try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow h-10 px-8"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}

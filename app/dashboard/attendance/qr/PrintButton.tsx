"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-opacity hover:opacity-90 flex items-center gap-2 mx-auto"
      style={{ background: "var(--accent)" }}
    >
      <Printer size={18} /> Print Now
    </button>
  );
}

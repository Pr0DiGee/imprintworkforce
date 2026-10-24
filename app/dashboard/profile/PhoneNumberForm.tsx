"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { savePhoneNumber } from "./actions";

export function PhoneNumberForm({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await savePhoneNumber(phone);
    setSaving(false);
    if ("error" in res) return toast.error(res.error);
    toast.success(phone.trim() ? "Phone number saved" : "Phone number removed");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2">
        <Phone size={16} style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Phone number</h3>
        {!initialPhone && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
            Add your phone number
          </span>
        )}
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Private: only your check-up partner for the week can see it, so they can call or WhatsApp you.
      </p>
      <div className="flex gap-2 max-w-md">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 0803 123 4567"
          aria-label="Phone number"
          className="flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
        />
        <button type="submit" disabled={saving} className="px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-60" style={{ background: "var(--accent)" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

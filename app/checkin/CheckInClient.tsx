"use client";

import { useState } from "react";
import { CongregationMember } from "@/types";
import { processCheckIn, lookupByPhone } from "./actions";
import { CheckCircle2, Search, ArrowRight } from "lucide-react";

interface CheckInClientProps {
  initialMember: CongregationMember | null;
  targetSunday: string;
}

export function CheckInClient({ initialMember, targetSunday }: CheckInClientProps) {
  const [member, setMember] = useState<CongregationMember | null>(initialMember);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Phone lookup state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhone) return;
    
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await lookupByPhone(lookupPhone);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.member) {
        setMember(res.member as CongregationMember);
        setIsLookingUp(false);
      } else {
        // Not found, pre-fill phone in the new form
        setMember({ name: "", phone: lookupPhone, email: "", address: "", birthday: "" });
        setIsLookingUp(false);
      }
    } catch (err) {
      setErrorMsg("Failed to search phone number.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    if (member?.id) {
      formData.append("id", member.id);
    }

    try {
      const res = await processCheckIn(formData, targetSunday);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-8 text-center shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--success-subtle)] flex items-center justify-center text-[var(--success)]">
            <CheckCircle2 size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">You're checked in!</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Thank you for joining us today. Enjoy the service!
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setMember({ name: "", phone: "", email: "", address: "", birthday: "" });
          }}
          className="text-sm font-medium text-[var(--accent)] hover:opacity-80"
        >
          Check in someone else
        </button>
      </div>
    );
  }

  if (isLookingUp && !member?.id) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Returning Visitor?</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Enter your phone number to quickly find your details.
        </p>
        
        {errorMsg && (
          <div className="p-3 mb-4 rounded-md text-sm bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handlePhoneLookup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Phone Number</label>
            <input
              type="tel"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder="e.g. +1234567890"
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !lookupPhone}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Searching..." : <><Search size={16} /> Find My Details</>}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLookingUp(false);
              setMember({ name: "", phone: "", email: "", address: "", birthday: "" });
            }}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            I'm a new visitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 shadow-sm">
      {member?.id ? (
        <div className="mb-6 p-4 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)] text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Imprint Global Church" className="w-16 h-16 object-contain" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-1">Welcome back,</p>
          <h2 className="text-xl font-bold text-[var(--accent-text)]">{member.name}</h2>
          <button
            onClick={() => setMember({ name: "", phone: "", email: "", address: "", birthday: "" })}
            className="text-sm font-medium mt-3 text-[var(--accent)] hover:opacity-80"
          >
            Check in someone else instead
          </button>
        </div>
      ) : (
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Imprint Global Church" className="w-16 h-16 object-contain" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Imprint Global Church</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Please fill in your details to check in.</p>
          <button
            onClick={() => setIsLookingUp(true)}
            className="text-sm font-medium text-[var(--accent)] hover:opacity-80"
          >
            Already been here? Find by phone
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 mb-4 rounded-md text-sm bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleCheckIn} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Full Name *</label>
          <input
            type="text"
            name="name"
            defaultValue={member?.name}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            required
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Phone Number *</label>
          <input
            type="tel"
            name="phone"
            defaultValue={member?.phone}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Email Address (Optional)</label>
          <input
            type="email"
            name="email"
            defaultValue={member?.email}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Birthday (Optional)</label>
            <input
              type="date"
              name="birthday"
              defaultValue={member?.birthday}
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Address (Optional)</label>
            <input
              type="text"
              name="address"
              defaultValue={member?.address}
              placeholder="City, Area"
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Checking in..." : <><CheckCircle2 size={18} /> Complete Check-In</>}
          </button>
        </div>
      </form>
    </div>
  );
}

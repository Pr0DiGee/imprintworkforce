"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRight, CalendarClock } from "lucide-react";
import {
  checkInRemembered,
  checkInByPhone,
  registerAndCheckIn,
  forgetDevice,
  type CheckInResult,
} from "./actions";

interface CheckInClientProps {
  isSunday: boolean;
  /** First name of the member this device remembers, if any */
  rememberedName: string | null;
}

type Step = "remembered" | "phone" | "new";

const inputClass = "w-full px-3 py-2.5 rounded-md border text-base";
const inputStyle = { background: "var(--bg-input)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };
const cardClass = "bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 shadow-sm";

function PrimaryButton({ loading, label, loadingLabel }: { loading: boolean; label: React.ReactNode; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ background: "var(--accent)" }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

export function CheckInClient({ isSunday, rememberedName }: CheckInClientProps) {
  const [step, setStep] = useState<Step>(rememberedName ? "remembered" : "phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null);

  function handleResult(res: CheckInResult) {
    if (res.status === "checked_in" || res.status === "already_checked_in") {
      setDone({ name: res.firstName, already: res.status === "already_checked_in" });
    } else if (res.status === "not_found") {
      setStep(step === "remembered" ? "phone" : "new");
    } else if (res.status === "closed") {
      setErrorMsg("Check-in is only open on Sundays.");
    } else if (res.status === "error") {
      setErrorMsg(res.message);
    }
  }

  async function run(action: () => Promise<CheckInResult>) {
    setLoading(true);
    setErrorMsg("");
    try {
      handleResult(await action());
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSunday) {
    return (
      <div className={`${cardClass} text-center`}>
        <div className="flex justify-center mb-4 text-[var(--text-muted)]">
          <CalendarClock size={40} />
        </div>
        <h2 className="text-lg font-bold mb-2 text-[var(--text-primary)]">Check-in opens on Sunday</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Scan this code again when you arrive for Sunday service. See you then!
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--success-subtle)] flex items-center justify-center text-[var(--success)]">
            <CheckCircle2 size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
          {done.already ? `You're already checked in, ${done.name}!` : `You're checked in, ${done.name}!`}
        </h2>
        <p className="text-[var(--text-secondary)]">Thank you for joining us today. Enjoy the service!</p>
      </div>
    );
  }

  const error = errorMsg && (
    <div role="alert" className="p-3 mb-4 rounded-md text-sm bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]">
      {errorMsg}
    </div>
  );

  if (step === "remembered" && rememberedName) {
    return (
      <div className={`${cardClass} text-center`}>
        <p className="text-sm text-[var(--text-secondary)] mb-1">Welcome back,</p>
        <h2 className="text-2xl font-bold mb-6 text-[var(--accent-text)]">{rememberedName}</h2>
        {error}
        <form onSubmit={(e) => { e.preventDefault(); run(checkInRemembered); }}>
          <PrimaryButton loading={loading} loadingLabel="Checking in…" label={<><CheckCircle2 size={18} /> Check in</>} />
        </form>
        <button
          type="button"
          onClick={async () => { await forgetDevice(); setErrorMsg(""); setStep("phone"); }}
          className="text-sm font-medium mt-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Not {rememberedName}? Check in someone else
        </button>
      </div>
    );
  }

  if (step === "phone") {
    return (
      <div className={cardClass}>
        <h2 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">What&apos;s your phone number?</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">We&apos;ll check you in, or set you up if it&apos;s your first visit.</p>
        {error}
        <form onSubmit={(e) => { e.preventDefault(); run(() => checkInByPhone(phone)); }} className="space-y-4">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0803 123 4567"
            aria-label="Phone number"
            className={inputClass}
            style={inputStyle}
          />
          <PrimaryButton loading={loading} loadingLabel="Checking…" label={<>Continue <ArrowRight size={18} /></>} />
        </form>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">Welcome! Looks like it&apos;s your first time</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">Tell us a little about yourself to check in.</p>
      {error}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          run(() => registerAndCheckIn(formData));
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Full Name *</label>
          <input type="text" name="name" autoComplete="name" required autoFocus className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Phone Number *</label>
          <input type="tel" name="phone" defaultValue={phone} required className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Email Address (Optional)</label>
          <input type="email" name="email" autoComplete="email" className={inputClass} style={inputStyle} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Birthday (Optional)</label>
            <input type="date" name="birthday" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--text-secondary)]">Address (Optional)</label>
            <input type="text" name="address" placeholder="City, Area" className={inputClass} style={inputStyle} />
          </div>
        </div>
        <PrimaryButton loading={loading} loadingLabel="Checking in…" label={<><CheckCircle2 size={18} /> Complete Check-In</>} />
      </form>
      <button
        type="button"
        onClick={() => { setErrorMsg(""); setStep("phone"); }}
        className="text-sm font-medium mt-5 w-full text-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Wrong number? Go back
      </button>
    </div>
  );
}

/**
 * Normalise a phone number so every way of writing the same Nigerian number
 * matches: "0803 123 4567", "08031234567", "2348031234567", "+234 803 123 4567"
 * all become "+2348031234567". Other international numbers keep their "+" form.
 * Returns null if the input doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  // Local Nigerian format: 0 + 10 digits
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  // Country code without "+"
  if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
  // "+234 0803..." (country code plus the local leading zero)
  if (digits.length === 14 && digits.startsWith("2340")) return `+234${digits.slice(4)}`;
  // 10 digits without the leading zero (e.g. "803 123 4567")
  if (digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Raw spellings a member's number may have been saved with before numbers were
 * normalised, so legacy records can still be found.
 */
export function legacyPhoneVariants(normalized: string): string[] {
  const variants = new Set<string>([normalized]);
  if (normalized.startsWith("+234")) {
    const national = normalized.slice(4);
    variants.add(`0${national}`);
    variants.add(`234${national}`);
    variants.add(national);
  }
  return Array.from(variants);
}

/** First word of a name, for greetings that reveal nothing else. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "friend";
}

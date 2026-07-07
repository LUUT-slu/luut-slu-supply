// Shared phone normalization for Saint Lucia numbers.
// Runs the shared text sanitizer first so pasted invisibles / fancy dashes
// never reach Shopify or the customer directory.

import { sanitizePhoneInput } from "./text.ts";

export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null;
  const raw = sanitizePhoneInput(phone);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 7) return `+1758${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

// Return the last 10 digits of the number. Useful as a secondary Shopify
// search term when their stored phone is not in strict E.164 form.
export function last10Digits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = sanitizePhoneInput(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}


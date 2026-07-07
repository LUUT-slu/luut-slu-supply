// Shared phone normalization for Saint Lucia numbers.
// Keeps behaviour consistent across create-draft-order, sync-shopify-customer,
// and sync-shopify-orders so that phone can serve as the primary customer key.

export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 7) return `+1758${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
}

// Return the last 10 digits of the number. Useful as a secondary Shopify
// search term when their stored phone is not in strict E.164 form.
export function last10Digits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

// Shared text sanitizers.
//
// Pastes from WhatsApp, iOS keyboards, and Shopify POS regularly carry
// invisible characters that break exact matching and pollute Shopify records:
//   • zero-width / BOM  (U+200B–U+200D, U+FEFF, U+2060)
//   • bidi / directional marks (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069)
//   • non-breaking spaces (U+00A0, U+202F, U+2007)
//   • “fancy” dashes (U+2010–U+2015, U+2212, U+FE58, U+FE63, U+FF0D)
//   • fullwidth digits / plus (U+FF10–U+FF19, U+FF0B)
//
// Every entry point that stores a phone / name MUST run these first.

const INVISIBLES =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const NBSPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

export function sanitizeText(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  // Normalize compatibility forms so fullwidth digits/plus collapse to ASCII.
  try { s = s.normalize("NFKC"); } catch { /* older runtimes */ }
  s = s.replace(INVISIBLES, "");
  s = s.replace(NBSPACES, " ");
  s = s.replace(DASHES, "-");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Strip everything except characters valid inside a phone number. */
export function sanitizePhoneInput(input: string | null | undefined): string {
  const clean = sanitizeText(input);
  // Keep +, digits, spaces, hyphens, parens — everything else is noise.
  return clean.replace(/[^\d+\s\-()]/g, "");
}

/**
 * A name is "phone-like" when it's entirely digits + phone punctuation and
 * has at least 7 digits (Saint Lucia local length).
 */
export function looksLikePhone(name: string | null | undefined): boolean {
  const s = sanitizeText(name);
  if (!s) return false;
  if (!/^[\d\s\-().+]+$/.test(s)) return false;
  return s.replace(/\D/g, "").length >= 7;
}

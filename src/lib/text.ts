// Client-side twin of supabase/functions/_shared/text.ts.
// Kept as a plain copy so it works in both Vite and Deno runtimes without
// cross-boundary imports.

const INVISIBLES =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const NBSPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

export function sanitizeText(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  try { s = s.normalize("NFKC"); } catch { /* noop */ }
  s = s.replace(INVISIBLES, "");
  s = s.replace(NBSPACES, " ");
  s = s.replace(DASHES, "-");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Strip invisible / non-phone characters. Safe to run on paste and on save. */
export function sanitizePhoneInput(input: string | null | undefined): string {
  const clean = sanitizeText(input);
  return clean.replace(/[^\d+\s\-()]/g, "");
}

export function looksLikePhone(name: string | null | undefined): boolean {
  const s = sanitizeText(name);
  if (!s) return false;
  if (!/^[\d\s\-().+]+$/.test(s)) return false;
  return s.replace(/\D/g, "").length >= 7;
}

/**
 * Turn any `<Input type="tel">` into a paste-safe phone field.
 *
 *   const [phone, setPhone] = useState("");
 *   <Input type="tel" {...phoneInputProps(phone, setPhone)} />
 *
 * The onChange handler sanitizes as the user types, and onPaste strips
 * invisible characters BEFORE React sees them (otherwise iOS re-inserts them).
 */
export function phoneInputProps(
  value: string,
  onChange: (next: string) => void,
) {
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(sanitizePhoneInput(e.target.value));
    },
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData?.getData("text");
      if (!pasted) return;
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? value.length;
      const end = target.selectionEnd ?? value.length;
      const next = sanitizePhoneInput(
        value.slice(0, start) + pasted + value.slice(end),
      );
      onChange(next);
    },
  };
}

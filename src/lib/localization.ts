// Localization data: countries, currencies, languages, helpers.
// Pure data + utilities — no React. Safe to import anywhere.

export interface Country {
  code: string;       // ISO-3166-1 alpha-2 (e.g. "LC")
  name: string;
  currency: string;   // ISO-4217 (e.g. "XCD")
  language: string;   // BCP47 lang code (e.g. "en")
}

export interface Currency {
  code: string;       // ISO-4217
  name: string;
  symbol: string;
}

export interface Language {
  code: string;       // "en" | "fr" | "es" | ...
  name: string;       // English name
  endonym: string;    // Native name
}

export const DEFAULT_COUNTRY = "LC";
export const DEFAULT_CURRENCY = "XCD";
export const DEFAULT_LANGUAGE = "en";

// Curated fallback country list. Will be merged with Shopify Markets at runtime.
// Currency/language guesses are sensible defaults; the user can always override.
export const COUNTRIES: Country[] = [
  { code: "LC", name: "Saint Lucia", currency: "XCD", language: "en" },
  { code: "US", name: "United States", currency: "USD", language: "en" },
  { code: "CA", name: "Canada", currency: "CAD", language: "en" },
  { code: "GB", name: "United Kingdom", currency: "GBP", language: "en" },
  { code: "FR", name: "France", currency: "EUR", language: "fr" },
  { code: "DE", name: "Germany", currency: "EUR", language: "en" },
  { code: "ES", name: "Spain", currency: "EUR", language: "es" },
  { code: "IT", name: "Italy", currency: "EUR", language: "en" },
  { code: "NL", name: "Netherlands", currency: "EUR", language: "en" },
  { code: "BE", name: "Belgium", currency: "EUR", language: "fr" },
  { code: "CH", name: "Switzerland", currency: "CHF", language: "en" },
  { code: "IE", name: "Ireland", currency: "EUR", language: "en" },
  { code: "PT", name: "Portugal", currency: "EUR", language: "en" },
  { code: "MX", name: "Mexico", currency: "MXN", language: "es" },
  { code: "BR", name: "Brazil", currency: "BRL", language: "es" },
  { code: "AR", name: "Argentina", currency: "ARS", language: "es" },
  { code: "CL", name: "Chile", currency: "CLP", language: "es" },
  { code: "CO", name: "Colombia", currency: "COP", language: "es" },
  { code: "AU", name: "Australia", currency: "AUD", language: "en" },
  { code: "NZ", name: "New Zealand", currency: "NZD", language: "en" },
  { code: "JP", name: "Japan", currency: "JPY", language: "en" },
  { code: "SG", name: "Singapore", currency: "SGD", language: "en" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", language: "en" },
  { code: "ZA", name: "South Africa", currency: "ZAR", language: "en" },
  { code: "JM", name: "Jamaica", currency: "JMD", language: "en" },
  { code: "TT", name: "Trinidad and Tobago", currency: "TTD", language: "en" },
  { code: "BB", name: "Barbados", currency: "BBD", language: "en" },
  { code: "DM", name: "Dominica", currency: "XCD", language: "en" },
  { code: "GD", name: "Grenada", currency: "XCD", language: "en" },
  { code: "VC", name: "Saint Vincent and the Grenadines", currency: "XCD", language: "en" },
  { code: "KN", name: "Saint Kitts and Nevis", currency: "XCD", language: "en" },
  { code: "AG", name: "Antigua and Barbuda", currency: "XCD", language: "en" },
  { code: "AI", name: "Anguilla", currency: "XCD", language: "en" },
  { code: "MS", name: "Montserrat", currency: "XCD", language: "en" },
  { code: "PR", name: "Puerto Rico", currency: "USD", language: "es" },
  { code: "DO", name: "Dominican Republic", currency: "DOP", language: "es" },
  { code: "HT", name: "Haiti", currency: "HTG", language: "fr" },
  { code: "MQ", name: "Martinique", currency: "EUR", language: "fr" },
  { code: "GP", name: "Guadeloupe", currency: "EUR", language: "fr" },
  { code: "GF", name: "French Guiana", currency: "EUR", language: "fr" },
];

export const CURRENCIES: Currency[] = [
  { code: "XCD", name: "East Caribbean Dollar", symbol: "EC$" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
  { code: "CLP", name: "Chilean Peso", symbol: "CL$" },
  { code: "COP", name: "Colombian Peso", symbol: "CO$" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
  { code: "TTD", name: "Trinidad & Tobago Dollar", symbol: "TT$" },
  { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "HTG", name: "Haitian Gourde", symbol: "G" },
];

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", endonym: "English" },
  { code: "fr", name: "French", endonym: "Français" },
  { code: "es", name: "Spanish", endonym: "Español" },
];

// Approximate FX rates relative to XCD (1 XCD = ~0.37 USD).
// Display-only. Real money calculations stay in XCD until checkout currency
// switching is wired up via Shopify @inContext.
export const FX_FROM_XCD: Record<string, number> = {
  XCD: 1,
  USD: 0.37,
  EUR: 0.34,
  GBP: 0.29,
  CAD: 0.51,
  AUD: 0.56,
  NZD: 0.61,
  CHF: 0.33,
  JPY: 56,
  SGD: 0.50,
  AED: 1.36,
  ZAR: 6.8,
  MXN: 6.3,
  BRL: 1.9,
  ARS: 360,
  CLP: 350,
  COP: 1500,
  JMD: 58,
  TTD: 2.5,
  BBD: 0.74,
  DOP: 22,
  HTG: 49,
};

export function getCountry(code: string): Country | undefined {
  const c = code?.toUpperCase();
  return COUNTRIES.find((x) => x.code === c);
}

export function getCurrency(code: string): Currency | undefined {
  const c = code?.toUpperCase();
  return CURRENCIES.find((x) => x.code === c);
}

export function getLanguage(code: string): Language | undefined {
  const c = code?.toLowerCase();
  return LANGUAGES.find((x) => x.code === c);
}

export function getDefaultsForCountry(code: string): { currency: string; language: string } {
  const c = getCountry(code);
  return {
    currency: c?.currency ?? DEFAULT_CURRENCY,
    language: c?.language ?? DEFAULT_LANGUAGE,
  };
}

// Flag emoji from ISO-3166-1 alpha-2 country code.
export function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const cp = [...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...cp);
}

/**
 * Convert an XCD amount to the target currency using approximate FX.
 * Returns null if no FX is available — caller should fall back to XCD.
 */
export function convertFromXCD(amountXCD: number, target: string): number | null {
  const rate = FX_FROM_XCD[target.toUpperCase()];
  if (!rate || !Number.isFinite(amountXCD)) return null;
  return amountXCD * rate;
}

export function formatCurrency(amount: number, currency: string): string {
  const c = getCurrency(currency);
  const symbol = c?.symbol ?? `${currency} `;
  const fractionDigits = currency.toUpperCase() === "JPY" ? 0 : 2;
  return `${symbol}${amount.toFixed(fractionDigits)}`;
}

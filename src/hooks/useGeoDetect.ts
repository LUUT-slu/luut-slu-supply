import { useEffect } from "react";
import { useLocaleStore } from "@/stores/localeStore";

const CACHE_KEY = "luut-geo-detect-v1";

function fromNavigatorLang(): string | null {
  if (typeof navigator === "undefined") return null;
  const lang = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;
  if (!lang) return null;
  const parts = lang.split("-");
  if (parts.length >= 2) return parts[1].toUpperCase();
  return null;
}

async function fetchGeo(): Promise<string | null> {
  // Try sessionStorage cache first
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("geo fetch failed");
    const data = await res.json();
    const code = (data?.country_code || data?.country || "").toString().toUpperCase();
    if (code && code.length === 2) {
      try { sessionStorage.setItem(CACHE_KEY, code); } catch { /* ignore */ }
      return code;
    }
  } catch { /* ignore */ }

  return fromNavigatorLang();
}

/**
 * Runs once per session. Sets the store's country/currency/language to the
 * detected market unless the visitor has already chosen something manually.
 */
export function useGeoDetect() {
  const hasUserOverridden = useLocaleStore((s) => s.hasUserOverridden);
  const hasAutoDetected = useLocaleStore((s) => s.hasAutoDetected);
  const applyDetected = useLocaleStore((s) => s.applyDetected);
  const markAutoDetected = useLocaleStore((s) => s.markAutoDetected);

  useEffect(() => {
    if (hasUserOverridden || hasAutoDetected) return;
    let cancelled = false;
    (async () => {
      const code = await fetchGeo();
      if (cancelled) return;
      if (code) applyDetected(code);
      markAutoDetected();
    })();
    return () => { cancelled = true; };
  }, [hasUserOverridden, hasAutoDetected, applyDetected, markAutoDetected]);
}

/** Synchronous helper for components that just need the cached detected country (no fetch). */
export function getDetectedCountry(): string | null {
  try { return sessionStorage.getItem(CACHE_KEY); } catch { return null; }
}

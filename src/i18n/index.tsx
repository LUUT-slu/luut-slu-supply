import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocaleStore } from "@/stores/localeStore";
import en from "./en.json";
import fr from "./fr.json";
import es from "./es.json";

type Dict = Record<string, string>;

const DICTS: Record<string, Dict> = {
  en: en as Dict,
  fr: fr as Dict,
  es: es as Dict,
};

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

interface I18nContextValue {
  lang: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useLocaleStore((s) => s.language);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[lang] ?? DICTS.en;
    const fallback = DICTS.en;
    return {
      lang,
      t: (key, vars) => interpolate(dict[key] ?? fallback[key] ?? key, vars),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback so components don't crash if used outside provider
  return {
    lang: "en",
    t: (key: string, vars?: Record<string, string | number>) =>
      interpolate((DICTS.en as Dict)[key] ?? key, vars),
  };
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  getDefaultsForCountry,
} from "@/lib/localization";

interface LocaleState {
  country: string;
  language: string;
  currency: string;
  /** True once the visitor has manually picked something — disables auto-detect overrides. */
  hasUserOverridden: boolean;
  /** True once auto-detect has run, so we don't re-run on every mount. */
  hasAutoDetected: boolean;
  /** True once the "shopping from X?" banner has been dismissed/acted on. */
  bannerDismissed: boolean;

  setCountry: (code: string, opts?: { syncDefaults?: boolean; manual?: boolean }) => void;
  setLanguage: (code: string, opts?: { manual?: boolean }) => void;
  setCurrency: (code: string, opts?: { manual?: boolean }) => void;
  applyDetected: (country: string) => void;
  dismissBanner: () => void;
  markAutoDetected: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      country: DEFAULT_COUNTRY,
      language: DEFAULT_LANGUAGE,
      currency: DEFAULT_CURRENCY,
      hasUserOverridden: false,
      hasAutoDetected: false,
      bannerDismissed: false,

      setCountry: (code, opts) => {
        const upper = code.toUpperCase();
        const sync = opts?.syncDefaults !== false;
        if (sync) {
          const d = getDefaultsForCountry(upper);
          set({
            country: upper,
            currency: d.currency,
            language: d.language,
            hasUserOverridden: opts?.manual ? true : get().hasUserOverridden,
          });
        } else {
          set({
            country: upper,
            hasUserOverridden: opts?.manual ? true : get().hasUserOverridden,
          });
        }
      },
      setLanguage: (code, opts) =>
        set({
          language: code.toLowerCase(),
          hasUserOverridden: opts?.manual ? true : get().hasUserOverridden,
        }),
      setCurrency: (code, opts) =>
        set({
          currency: code.toUpperCase(),
          hasUserOverridden: opts?.manual ? true : get().hasUserOverridden,
        }),
      applyDetected: (country) => {
        if (get().hasUserOverridden) return;
        const upper = country.toUpperCase();
        const d = getDefaultsForCountry(upper);
        set({
          country: upper,
          currency: d.currency,
          language: d.language,
        });
      },
      dismissBanner: () => set({ bannerDismissed: true, hasUserOverridden: true }),
      markAutoDetected: () => set({ hasAutoDetected: true }),
    }),
    {
      name: "luut-locale-v1",
      partialize: (s) => ({
        country: s.country,
        language: s.language,
        currency: s.currency,
        hasUserOverridden: s.hasUserOverridden,
        bannerDismissed: s.bannerDismissed,
      }),
    },
  ),
);

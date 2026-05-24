import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLocaleStore } from "@/stores/localeStore";
import { useGeoDetect, getDetectedCountry } from "@/hooks/useGeoDetect";
import {
  getCountry,
  getLanguage,
  getDefaultsForCountry,
  flagEmoji,
  DEFAULT_COUNTRY,
} from "@/lib/localization";
import { useT } from "@/i18n";

export function LocaleDetectBanner() {
  // Make sure detection has a chance to run.
  useGeoDetect();
  const { t } = useT();

  const country = useLocaleStore((s) => s.country);
  const bannerDismissed = useLocaleStore((s) => s.bannerDismissed);
  const hasUserOverridden = useLocaleStore((s) => s.hasUserOverridden);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const dismissBanner = useLocaleStore((s) => s.dismissBanner);

  const [detected, setDetected] = useState<string | null>(() => getDetectedCountry());

  useEffect(() => {
    if (detected) return;
    const id = window.setInterval(() => {
      const c = getDetectedCountry();
      if (c) { setDetected(c); window.clearInterval(id); }
    }, 800);
    return () => window.clearInterval(id);
  }, [detected]);

  if (bannerDismissed || hasUserOverridden) return null;
  if (!detected) return null;
  if (detected.toUpperCase() === country.toUpperCase()) return null;
  if (detected.toUpperCase() === DEFAULT_COUNTRY && country === DEFAULT_COUNTRY) return null;

  const target = getCountry(detected);
  if (!target) return null;

  const defaults = getDefaultsForCountry(detected);
  const lang = getLanguage(defaults.language);

  return (
    <div className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
      <div className="container flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="text-xl leading-none" aria-hidden>{flagEmoji(detected)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {t("locale.banner.title", { country: target.name })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("locale.banner.body", {
              language: lang?.endonym ?? defaults.language.toUpperCase(),
              currency: defaults.currency,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCountry(detected, { manual: true });
              dismissBanner();
            }}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground active:scale-95 transition"
          >
            {t("locale.banner.switch")}
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:scale-95 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocaleDetectBanner;

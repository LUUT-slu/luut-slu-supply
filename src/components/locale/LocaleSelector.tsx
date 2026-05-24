import { useMemo, useState } from "react";
import { Check, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/stores/localeStore";
import {
  COUNTRIES,
  CURRENCIES,
  LANGUAGES,
  flagEmoji,
  getCurrency,
  type Country,
  type Currency,
  type Language,
} from "@/lib/localization";
import { useShopifyMarkets } from "@/hooks/useShopifyMarkets";
import { useT } from "@/i18n";

interface LocaleSelectorProps {
  compact?: boolean;
  className?: string;
}

export function LocaleSelector({ compact = false, className }: LocaleSelectorProps) {
  const { t } = useT();
  const country = useLocaleStore((s) => s.country);
  const language = useLocaleStore((s) => s.language);
  const currency = useLocaleStore((s) => s.currency);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const setCurrency = useLocaleStore((s) => s.setCurrency);

  const { data: markets } = useShopifyMarkets();

  const [open, setOpen] = useState(false);
  const [qCountry, setQCountry] = useState("");
  const [qLang, setQLang] = useState("");
  const [qCcy, setQCcy] = useState("");

  // Merge Shopify-configured countries with our fallback list, dedup by ISO code.
  const mergedCountries: Array<Country & { fromShopify: boolean }> = useMemo(() => {
    const map = new Map<string, Country & { fromShopify: boolean }>();
    (markets ?? []).forEach((m) => {
      const code = m.isoCode?.toUpperCase();
      if (!code) return;
      const lang = m.availableLanguages?.[0]?.isoCode?.toLowerCase() ?? "en";
      map.set(code, {
        code,
        name: m.name,
        currency: m.currency?.isoCode?.toUpperCase() ?? "USD",
        language: lang,
        fromShopify: true,
      });
    });
    COUNTRIES.forEach((c) => {
      if (!map.has(c.code)) map.set(c.code, { ...c, fromShopify: false });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [markets]);

  // Merge currencies/languages similarly so Shopify-added ones surface.
  const mergedCurrencies: Currency[] = useMemo(() => {
    const map = new Map<string, Currency>();
    CURRENCIES.forEach((c) => map.set(c.code, c));
    (markets ?? []).forEach((m) => {
      const code = m.currency?.isoCode?.toUpperCase();
      if (code && !map.has(code)) {
        map.set(code, { code, name: m.currency.name ?? code, symbol: m.currency.symbol ?? code });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [markets]);

  const mergedLanguages: Language[] = useMemo(() => {
    const map = new Map<string, Language>();
    LANGUAGES.forEach((l) => map.set(l.code, l));
    (markets ?? []).forEach((m) => {
      m.availableLanguages?.forEach((l) => {
        const code = l.isoCode?.toLowerCase();
        if (code && !map.has(code)) {
          map.set(code, { code, name: l.name ?? code, endonym: l.endonymName ?? code });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [markets]);

  const filteredCountries = useMemo(() => {
    const q = qCountry.trim().toLowerCase();
    if (!q) return mergedCountries;
    return mergedCountries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [mergedCountries, qCountry]);

  const filteredLanguages = useMemo(() => {
    const q = qLang.trim().toLowerCase();
    if (!q) return mergedLanguages;
    return mergedLanguages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.endonym.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [mergedLanguages, qLang]);

  const filteredCurrencies = useMemo(() => {
    const q = qCcy.trim().toLowerCase();
    if (!q) return mergedCurrencies;
    return mergedCurrencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [mergedCurrencies, qCcy]);

  const currencySymbol = getCurrency(currency)?.symbol ?? currency;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("locale.title")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/60 px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition active:scale-95 hover:border-primary/40 hover:bg-primary/5 touch-manipulation",
            compact && "px-2 py-1.5",
            className,
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {flagEmoji(country)}
          </span>
          {!compact && (
            <>
              <span className="hidden sm:inline tracking-wide">{country}</span>
              <span className="text-muted-foreground">·</span>
              <span className="tracking-wide">{currency}</span>
            </>
          )}
          {compact && <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[92vw] max-w-[360px] border-primary/20 bg-background/95 p-0 backdrop-blur-xl"
      >
        <div className="border-b border-border/60 px-4 pt-4 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">
            {t("locale.title")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("locale.subtitle")}</p>
        </div>
        <Tabs defaultValue="country" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-border/60 bg-transparent p-0">
            <TabsTrigger
              value="country"
              className="rounded-none border-b-2 border-transparent py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("locale.tab.country")}
            </TabsTrigger>
            <TabsTrigger
              value="language"
              className="rounded-none border-b-2 border-transparent py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("locale.tab.language")}
            </TabsTrigger>
            <TabsTrigger
              value="currency"
              className="rounded-none border-b-2 border-transparent py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("locale.tab.currency")}
            </TabsTrigger>
          </TabsList>

          {/* COUNTRY */}
          <TabsContent value="country" className="m-0">
            <div className="p-3">
              <Input
                value={qCountry}
                onChange={(e) => setQCountry(e.target.value)}
                placeholder={t("locale.search.country")}
                className="h-9 text-sm"
              />
            </div>
            <ScrollArea className="h-[320px] px-1.5 pb-2">
              <ul className="space-y-0.5 px-1.5">
                {filteredCountries.map((c) => {
                  const active = c.code === country;
                  return (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => setCountry(c.code, { manual: true })}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition active:scale-[0.98] touch-manipulation",
                          active ? "bg-primary/15 text-foreground" : "hover:bg-primary/5",
                        )}
                      >
                        <span className="text-lg leading-none" aria-hidden>{flagEmoji(c.code)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{c.name}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.code} · {c.currency} · {c.language.toUpperCase()}
                            {c.fromShopify && <span className="ml-1 text-primary">• Shopify</span>}
                          </span>
                        </span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
                {filteredCountries.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</li>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>

          {/* LANGUAGE */}
          <TabsContent value="language" className="m-0">
            <div className="p-3">
              <Input
                value={qLang}
                onChange={(e) => setQLang(e.target.value)}
                placeholder={t("locale.search.language")}
                className="h-9 text-sm"
              />
            </div>
            <ScrollArea className="h-[320px] px-1.5 pb-2">
              <ul className="space-y-0.5 px-1.5">
                {filteredLanguages.map((l) => {
                  const active = l.code === language;
                  return (
                    <li key={l.code}>
                      <button
                        type="button"
                        onClick={() => setLanguage(l.code, { manual: true })}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition active:scale-[0.98] touch-manipulation",
                          active ? "bg-primary/15 text-foreground" : "hover:bg-primary/5",
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold uppercase text-primary">
                          {l.code}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{l.endonym}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{l.name}</span>
                        </span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
                {filteredLanguages.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</li>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>

          {/* CURRENCY */}
          <TabsContent value="currency" className="m-0">
            <div className="p-3">
              <Input
                value={qCcy}
                onChange={(e) => setQCcy(e.target.value)}
                placeholder={t("locale.search.currency")}
                className="h-9 text-sm"
              />
            </div>
            <ScrollArea className="h-[320px] px-1.5 pb-2">
              <ul className="space-y-0.5 px-1.5">
                {filteredCurrencies.map((c) => {
                  const active = c.code === currency;
                  return (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => setCurrency(c.code, { manual: true })}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition active:scale-[0.98] touch-manipulation",
                          active ? "bg-primary/15 text-foreground" : "hover:bg-primary/5",
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {c.symbol}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{c.name}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{c.code}</span>
                        </span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
                {filteredCurrencies.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</li>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        <div className="border-t border-border/60 px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold uppercase tracking-wider text-primary active:scale-95 transition"
          >
            {t("locale.done")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LocaleSelector;

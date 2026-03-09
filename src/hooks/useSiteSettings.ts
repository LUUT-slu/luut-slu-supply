import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PopupSetting {
  id: string;
  name: string;
  enabled: boolean;
  frequency: "once_per_session" | "once_per_24h";
  startAt: string | null;
  endAt: string | null;
  pages: string[];
  buttonUrl: string;
}

export interface CheckoutReminderSetting {
  enabled: boolean;
  code: string;
  message: string;
}

export interface ColorVariantCardsSetting {
  enabled: boolean;
  showOnlyInStock: boolean;
}

export interface HomepageSection {
  id: string;
  type: "category" | "best_sellers" | "trending" | "new_arrivals" | "featured";
  slug?: string;
  label: string;
  limit: number;
  enabled: boolean;
  featuredProductIds?: string[];
}

export interface HeroConfig {
  imageUrl: string | null;
  heading: string;
  subheading: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
}

export interface HomepageLayout {
  sections: HomepageSection[];
  hero: HeroConfig;
}

export const DEFAULT_HERO: HeroConfig = {
  imageUrl: null,
  heading: "",
  subheading: "",
  buttonText: "Shop Outfits",
  buttonLink: "/shop",
  secondaryButtonText: "New Arrivals",
  secondaryButtonLink: "/shop/new-arrivals",
};

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayout = {
  sections: [
    { id: "sec-trending", type: "trending", label: "What's Trending", limit: 6, enabled: true },
    { id: "sec-1", type: "category", slug: "beanies-tams", label: "Beanies & Tams", limit: 4, enabled: true },
    { id: "sec-2", type: "category", slug: "shoes", label: "Shoes", limit: 4, enabled: true },
    { id: "sec-3", type: "category", slug: "hoodies", label: "Hoodies", limit: 4, enabled: true },
    { id: "sec-4", type: "category", slug: "shirts", label: "Shirts", limit: 4, enabled: true },
    { id: "sec-best", type: "best_sellers", label: "Best Sellers This Week", limit: 8, enabled: true },
  ],
  hero: DEFAULT_HERO,
};

export interface SiteSettings {
  popups: PopupSetting[];
  freezeCheckout: boolean;
  hideSoldOut: boolean;
  checkoutReminder: CheckoutReminderSetting;
  colorVariantCards: ColorVariantCardsSetting;
  homepageLayout: HomepageLayout;
}

async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings" as any)
    .select("id, value");

  if (error) throw error;

  const settings: Record<string, any> = {};
  (data as any[])?.forEach((row: { id: string; value: any }) => {
    settings[row.id] = row.value;
  });

  const rawLayout = settings.homepage_layout as any;

  // Migrate old format (showTrending/showBestSellers booleans) to new section-based format
  let homepageLayout: HomepageLayout;
  if (rawLayout && rawLayout.sections && rawLayout.hero) {
    homepageLayout = rawLayout as HomepageLayout;
  } else if (rawLayout && rawLayout.sections) {
    // Old format: has sections array but no hero — migrate
    homepageLayout = {
      sections: [
        ...(rawLayout.showTrending !== false ? [{ id: "sec-trending", type: "trending" as const, label: "What's Trending", limit: 6, enabled: true }] : []),
        ...rawLayout.sections,
        ...(rawLayout.showBestSellers !== false ? [{ id: "sec-best", type: "best_sellers" as const, label: "Best Sellers This Week", limit: 8, enabled: true }] : []),
      ],
      hero: DEFAULT_HERO,
    };
  } else {
    homepageLayout = DEFAULT_HOMEPAGE_LAYOUT;
  }

  return {
    popups: (settings.popups as PopupSetting[]) || [],
    freezeCheckout: settings.freeze_checkout === true,
    hideSoldOut: settings.hide_sold_out === true,
    checkoutReminder: (settings.checkout_reminder as CheckoutReminderSetting) || {
      enabled: false,
      code: "",
      message: "",
    },
    colorVariantCards: (settings.color_variant_cards as ColorVariantCardsSetting) || {
      enabled: false,
      showOnlyInStock: true,
    },
    homepageLayout,
  };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export async function updateSiteSetting(id: string, value: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from("site_settings" as any)
    .upsert({ id, value, updated_at: new Date().toISOString(), updated_by: user?.id } as any, { onConflict: "id" });
  if (error) throw error;
}

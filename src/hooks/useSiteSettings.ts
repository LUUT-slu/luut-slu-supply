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
  type: "category" | "best_sellers" | "trending" | "new_arrivals" | "featured" | "promo_collection";
  /** Shopify collection handle (or legacy category slug) */
  slug?: string;
  /** Cached Shopify collection title — used for admin display when collection is unavailable */
  collectionTitle?: string;
  label: string;
  subtitle?: string;
  limit: number;
  enabled: boolean;
  featuredProductIds?: string[];
  /** Promo collection section: collection handle this section pulls from */
  promoCollectionHandle?: string;
  /** Promo collection section: auto-move to top when a matching active promotion exists */
  autoPrioritize?: boolean;
  /** Promo collection section: optional badge override */
  badgeLabel?: string;
  /** Promo collection section: render an empty-state message instead of hiding when no promos */
  showEmptyState?: boolean;
  /** Promo collection section: copy shown when showEmptyState is true and no promos exist */
  emptyStateMessage?: string;
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

export type AdminAlertKey =
  | "new_order"
  | "seller_application"
  | "customer_signup"
  | "contact_form"
  | "payment_issue"
  | "seller_product"
  | "low_stock"
  | "review_submitted"
  | "order_status_change"
  | "general";

export interface NotificationSettings {
  adminEmail: string;
  senderEmail: string; // optional override of RESEND_FROM_EMAIL (display only)
  masterEnabled: boolean;
  instantSend: boolean;
  batchMode: boolean;
  alerts: Record<AdminAlertKey, boolean>;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  adminEmail: "usual.suspect.118@gmail.com",
  senderEmail: "",
  masterEnabled: true,
  instantSend: true,
  batchMode: false,
  alerts: {
    new_order: true,
    seller_application: true,
    customer_signup: true,
    contact_form: true,
    payment_issue: true,
    seller_product: true,
    low_stock: true,
    review_submitted: true,
    order_status_change: true,
    general: true,
  },
};

export interface MarketingStudioSettings {
  brandName: string;
  brandLogoUrl: string;
  defaultCta: string;
  meetupLocations: string;
  urgencyText: string;
  showPriceByDefault: boolean;
}

export const DEFAULT_MARKETING_STUDIO: MarketingStudioSettings = {
  brandName: "Luut SLU",
  brandLogoUrl: "",
  defaultCta: "DM to Cop",
  meetupLocations: "Castries · Gros Islet · Vieux Fort",
  urgencyText: "Limited drop",
  showPriceByDefault: true,
};

export interface SiteSettings {
  popups: PopupSetting[];
  freezeCheckout: boolean;
  hideSoldOut: boolean;
  checkoutReminder: CheckoutReminderSetting;
  colorVariantCards: ColorVariantCardsSetting;
  homepageLayout: HomepageLayout;
  notifications: NotificationSettings;
  marketingStudio: MarketingStudioSettings;
}

function buildDefaultSettings(): SiteSettings {
  return {
    popups: [],
    freezeCheckout: false,
    hideSoldOut: false,
    checkoutReminder: { enabled: false, code: "", message: "" },
    colorVariantCards: { enabled: false, showOnlyInStock: true },
    homepageLayout: DEFAULT_HOMEPAGE_LAYOUT,
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      alerts: { ...DEFAULT_NOTIFICATION_SETTINGS.alerts },
    },
    marketingStudio: { ...DEFAULT_MARKETING_STUDIO },
  };
}

async function fetchSiteSettings(): Promise<SiteSettings> {
  // 8s ceiling — never let site_settings block homepage render
  const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: new Error("site_settings timeout") }), 8000)
  );
  const fetchPromise = supabase
    .from("site_settings" as any)
    .select("id, value")
    .then((res) => res as any);

  const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

  if (error) {
    console.warn("[useSiteSettings] falling back to defaults:", error.message);
    return buildDefaultSettings();
  }

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
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...((settings.notifications as Partial<NotificationSettings>) || {}),
      alerts: {
        ...DEFAULT_NOTIFICATION_SETTINGS.alerts,
        ...(((settings.notifications as any)?.alerts) || {}),
      },
    },
    marketingStudio: {
      ...DEFAULT_MARKETING_STUDIO,
      ...((settings.marketing_studio as Partial<MarketingStudioSettings>) || {}),
    },
  };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    // Longer stale time — homepage doesn't need fresh popups every render
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    // Always resolve to safe defaults so Index never blocks
    placeholderData: buildDefaultSettings,
  });
}

export async function updateSiteSetting(id: string, value: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from("site_settings" as any)
    .upsert({ id, value, updated_at: new Date().toISOString(), updated_by: user?.id } as any, { onConflict: "id" });
  if (error) throw error;
}

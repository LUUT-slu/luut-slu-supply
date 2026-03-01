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

export interface SiteSettings {
  popups: PopupSetting[];
  freezeCheckout: boolean;
  hideSoldOut: boolean;
  checkoutReminder: CheckoutReminderSetting;
  colorVariantCards: ColorVariantCardsSetting;
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
  };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export async function updateSiteSetting(id: string, value: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("site_settings" as any)
    .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
    .eq("id", id);
  if (error) throw error;
}

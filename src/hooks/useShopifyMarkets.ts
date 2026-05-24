import { useQuery } from "@tanstack/react-query";
import { storefrontApiRequest } from "@/lib/shopify";

export interface ShopifyMarketCountry {
  isoCode: string;
  name: string;
  currency: { isoCode: string; name?: string; symbol?: string };
  availableLanguages: Array<{ isoCode: string; endonymName: string; name: string }>;
}

const LOCALIZATION_QUERY = `
  query GetLocalization {
    localization {
      availableCountries {
        isoCode
        name
        currency { isoCode name symbol }
        availableLanguages { isoCode endonymName name }
      }
    }
  }
`;

/**
 * Pulls the markets configured in Shopify Markets via the Storefront API.
 * Lets new countries/currencies/languages show up automatically without code edits.
 */
export function useShopifyMarkets() {
  return useQuery({
    queryKey: ["shopify-localization"],
    queryFn: async (): Promise<ShopifyMarketCountry[]> => {
      try {
        const res = await storefrontApiRequest(LOCALIZATION_QUERY);
        const list = res?.data?.localization?.availableCountries;
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

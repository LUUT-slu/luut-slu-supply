import { useMemo } from "react";
import { useActivePromotionCampaigns } from "./usePromotionCampaigns";
import { resolveProductPrice, PriceableProduct, ResolvedPrice } from "@/lib/pricing";

/** Re-export of the underlying hook for convenience. */
export { useActivePromotionCampaigns as useActivePromotions } from "./usePromotionCampaigns";

/**
 * Resolve a single product's display price against the current active campaigns.
 * Re-renders automatically when the admin toggles a promotion on/off.
 */
export function useResolvedPrice(product: PriceableProduct): ResolvedPrice {
  const { data: campaigns } = useActivePromotionCampaigns();
  const key = `${product.id}|${product.originalId || ""}|${product.price}|${(product.collectionHandles || []).join(",")}|${product.category || ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolveProductPrice(product, campaigns), [key, campaigns]);
}

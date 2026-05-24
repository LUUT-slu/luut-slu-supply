import type { PromotionCampaign } from "@/hooks/usePromotionCampaigns";

export interface PriceableProduct {
  id: string;
  /** Original (unsplit) product id, when the visible card represents a variant split. */
  originalId?: string;
  price: number;
  collectionHandles?: string[];
  category?: string | null;
  vendor?: string | null;
}

export interface ResolvedPrice {
  original: number;
  final: number;
  hasDiscount: boolean;
  savings: number;
  percentOff: number;
  badge?: string;
  promoName?: string;
  promoDescription?: string;
  campaignId?: string;
  bannerText?: string;
  ctaUrl?: string;
  /** ISO end date of the matched campaign, when present. */
  endDate?: string | null;
}

function applyDiscount(price: number, c: PromotionCampaign): number {
  switch (c.discount_type) {
    case "percent":
      return Math.max(0, price * (1 - (Number(c.discount_value) || 0) / 100));
    case "fixed":
      return Math.max(0, price - (Number(c.discount_value) || 0));
    case "override":
      return Math.max(0, Number(c.discount_value) || 0);
    case "none":
    default:
      return price;
  }
}

function matchRank(p: PriceableProduct, c: PromotionCampaign): number {
  // Build the set of ids that should match a campaign's product references:
  // the visible card id, the original (unsplit) product id, and a defensive
  // fallback that strips the `__variant` suffix used by variantSplitter.
  const ids = new Set<string>();
  if (p.id) {
    ids.add(p.id);
    const stripped = p.id.split("__")[0];
    if (stripped && stripped !== p.id) ids.add(stripped);
  }
  if (p.originalId) ids.add(p.originalId);

  // Excluded explicitly
  if (Array.isArray(c.exclude_product_ids) && c.exclude_product_ids.some((id) => ids.has(id))) return -1;
  // 1) specific product reference always wins
  if (Array.isArray(c.product_refs) && c.product_refs.some((r) => ids.has(r.id))) return 1;
  const mode = c.target_mode || "products";
  // 2) shopify collection handle match
  if (mode === "collections" && Array.isArray(c.target_collections) && c.target_collections.length && p.collectionHandles?.length) {
    const set = new Set(c.target_collections.map((h) => h.toLowerCase()));
    if (p.collectionHandles.some((h) => set.has(h.toLowerCase()))) return 2;
  }
  // 3) category label match
  if (mode === "categories" && Array.isArray(c.target_categories) && c.target_categories.length && p.category) {
    const set = new Set(c.target_categories.map((h) => h.toLowerCase()));
    if (set.has(p.category.toLowerCase())) return 3;
  }
  // 4) sitewide
  if (mode === "sitewide") return 4;
  return -1;
}

/**
 * Resolve the displayed price for a product given the set of active promotion
 * campaigns. Picks the single best-matching campaign — no stacking.
 * Priority: specific product > collection > category > sitewide. Ties broken
 * by manual `priority`, then most-recent.
 */
export function resolveProductPrice(
  product: PriceableProduct,
  activeCampaigns: PromotionCampaign[] | undefined,
): ResolvedPrice {
  const original = Number(product.price) || 0;
  const base: ResolvedPrice = {
    original,
    final: original,
    hasDiscount: false,
    savings: 0,
    percentOff: 0,
  };
  if (!activeCampaigns || activeCampaigns.length === 0) return base;

  const ranked = activeCampaigns
    .map((c) => ({ c, rank: matchRank(product, c) }))
    .filter((x) => x.rank > 0)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const pa = Number(a.c.priority) || 0;
      const pb = Number(b.c.priority) || 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.c.created_at).getTime() - new Date(a.c.created_at).getTime();
    });

  if (ranked.length === 0) return base;
  const c = ranked[0].c;
  const final = Math.round(applyDiscount(original, c) * 100) / 100;
  const savings = Math.max(0, Math.round((original - final) * 100) / 100);
  const hasDiscount = final < original && c.discount_type !== "none";

  return {
    original,
    final,
    hasDiscount,
    savings,
    percentOff: original > 0 && hasDiscount ? Math.round((savings / original) * 100) : 0,
    badge: c.badge_text || c.promo_label,
    promoName: c.name,
    promoDescription: c.description ?? undefined,
    campaignId: c.id,
    bannerText: c.banner_text ?? undefined,
    ctaUrl: c.cta_url ?? undefined,
    endDate: c.end_date ?? null,
  };
}

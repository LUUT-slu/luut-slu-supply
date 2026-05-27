import { Link } from "react-router-dom";
import { ArrowRight, Flame, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useActivePromotionCampaigns } from "@/hooks/usePromotionCampaigns";
import { resolveProductPrice } from "@/lib/pricing";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { shuffleArray } from "@/lib/utils";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { useCountdown } from "@/hooks/useCountdown";
import type { PromotionCampaign } from "@/hooks/usePromotionCampaigns";
import { useMemo } from "react";

interface PromoCollectionSectionProps {
  slug: string;
  label: string;
  subtitle?: string;
  limit?: number;
  badgeLabel?: string;
  matchedCampaign?: PromotionCampaign;
  showEmptyState?: boolean;
  emptyStateMessage?: string;
  /** When true, ignore slug and pull discounted products from every active campaign. */
  autoScan?: boolean;
}

export function PromoCollectionSection({
  slug,
  label,
  subtitle,
  limit = 8,
  badgeLabel,
  matchedCampaign,
  showEmptyState = false,
  emptyStateMessage = "No active promos right now.",
  autoScan = true,
}: PromoCollectionSectionProps) {
  const { data: siteSettings } = useSiteSettings();
  const { data: activeCampaigns } = useActivePromotionCampaigns();

  // In auto-scan mode pull a broad page (no slug). Otherwise stick to the pinned collection.
  const fetchOptions = autoScan
    ? { limit: 100 }
    : { categorySlug: slug, limit: limit * 3 };
  const { products, loading } = useHybridProducts(fetchOptions);

  const { displayProducts, contributingCampaignIds } = useMemo(() => {
    let list = products;
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    if (siteSettings?.hideSoldOut) {
      list = list.filter((p) => p.stockStatus !== "out_of_stock");
    }

    const matchedIds = new Set<string>();
    const enriched = list
      .map((p) => {
        const isVariant = "originalProductId" in p && !!(p as VariantListingProduct).originalProductId;
        const r = resolveProductPrice(
          {
            id: p.id,
            originalId: isVariant ? (p as VariantListingProduct).originalProductId : p.id,
            price: parseFloat(p.price.amount),
            collectionHandles: (p as any).collectionHandles,
            category: p.category,
            vendor: p.vendor,
          },
          activeCampaigns,
        );
        if (r.hasDiscount && r.campaignId) matchedIds.add(r.campaignId);
        return { p, r };
      })
      .filter((x) => x.r.hasDiscount)
      // Best deals first within each stock bucket
      .sort((a, b) => b.r.percentOff - a.r.percentOff);

    const sorted = sortByStockStatus(enriched.map((x) => x.p) as VariantListingProduct[]);
    return {
      displayProducts: sorted.slice(0, limit),
      contributingCampaignIds: matchedIds,
    };
  }, [products, siteSettings, activeCampaigns, limit]);

  // Pick the soonest-ending campaign that actually contributed a product to the section
  const headerCampaign = useMemo<PromotionCampaign | undefined>(() => {
    if (!activeCampaigns?.length) return matchedCampaign;
    const candidates = activeCampaigns.filter(
      (c) => c.end_date && contributingCampaignIds.has(c.id),
    );
    if (candidates.length === 0) return matchedCampaign;
    return candidates.sort(
      (a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime(),
    )[0];
  }, [activeCampaigns, contributingCampaignIds, matchedCampaign]);

  const countdown = useCountdown(headerCampaign?.end_date ?? null);

  if (loading) return null;

  const badge =
    badgeLabel ||
    headerCampaign?.badge_text ||
    headerCampaign?.promo_label ||
    "SALE";

  const isEmpty = displayProducts.length === 0;
  if (isEmpty && !showEmptyState) return null;

  return (
    <section className="border-t border-border/50 bg-gradient-to-b from-destructive/[0.04] to-transparent py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground shadow-sm">
                <Flame className="h-3 w-3" />
                {badge}
              </span>
              {headerCampaign?.end_date && !countdown.isExpired && (
                <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                  <Clock className="h-3 w-3" />
                  Ends in {countdown.formatted}
                </span>
              )}
              {headerCampaign?.end_date && countdown.isExpired === false && false}
              {!headerCampaign?.end_date && matchedCampaign?.end_date && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-destructive">
                  Limited time
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{label}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {slug && !isEmpty && !autoScan && (
            <Button asChild variant="ghost" size="sm" className="font-body text-sm shrink-0">
              <Link to={`/shop/${slug}`}>
                View All
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
        {isEmpty ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-card/40 py-8 text-center text-sm text-muted-foreground">
            {emptyStateMessage}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 rounded-sm">
            {displayProducts.map((product, idx) => (
              <UnifiedProductCard key={product.id} product={product} priority={idx < 4} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

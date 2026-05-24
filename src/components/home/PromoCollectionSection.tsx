import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useActivePromotionCampaigns } from "@/hooks/usePromotionCampaigns";
import { resolveProductPrice } from "@/lib/pricing";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
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
}: PromoCollectionSectionProps) {
  // Pull a wider net so we have enough discounted products to fill the section
  const { products, loading } = useHybridProducts({ categorySlug: slug, limit: limit * 3 });
  const { data: siteSettings } = useSiteSettings();
  const { data: activeCampaigns } = useActivePromotionCampaigns();

  const displayProducts = useMemo(() => {
    let list = products;
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    if (siteSettings?.hideSoldOut) {
      list = list.filter((p) => p.stockStatus !== "out_of_stock");
    }
    // Keep only products that resolve to a discount under the active campaigns
    const discounted = list.filter((p) => {
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
      return r.hasDiscount;
    });
    const sorted = sortByStockStatus(discounted as VariantListingProduct[]);
    return sorted.slice(0, limit);
  }, [products, siteSettings, activeCampaigns, limit]);

  if (loading) return null;

  const badge =
    badgeLabel ||
    matchedCampaign?.badge_text ||
    matchedCampaign?.promo_label ||
    "SALE";

  const isEmpty = displayProducts.length === 0;
  if (isEmpty && !showEmptyState) return null;

  return (
    <section className="border-t border-border/50 bg-gradient-to-b from-destructive/[0.04] to-transparent py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground shadow-sm">
                <Flame className="h-3 w-3" />
                {badge}
              </span>
              {matchedCampaign?.end_date && (
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
          {slug && !isEmpty && (
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 rounded-sm">
            {displayProducts.map((product, idx) => (
              <UnifiedProductCard key={product.id} product={product} priority={idx < 4} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useShopifyCollections } from "@/hooks/useShopifyCollections";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useProductSalesCounts, lookupSoldCount } from "@/hooks/useProductSalesCounts";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { shuffleArray } from "@/lib/utils";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { cn } from "@/lib/utils";

export function MarketplaceFeed() {
  const [active, setActive] = useState<string>(""); // "" = All
  const { collections, loading: collectionsLoading } = useShopifyCollections(50);
  const { products, loading } = useHybridProducts({
    categorySlug: active || undefined,
    limit: 48,
  });
  const { data: siteSettings } = useSiteSettings();
  const { data: soldLookup } = useProductSalesCounts();

  const displayProducts = useMemo(() => {
    let list = products;
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    // Shuffle so customers discover different products on each reload,
    // then keep sold-out items at the end.
    const shuffled = shuffleArray(list as VariantListingProduct[]);
    const sorted = sortByStockStatus(shuffled).sort((a, b) => {
      const aStock = a.stockStatus === "out_of_stock" ? 1 : 0;
      const bStock = b.stockStatus === "out_of_stock" ? 1 : 0;
      if (aStock !== bStock) return aStock - bStock;
      const aSold = lookupSoldCount(soldLookup, { handle: a.handle, id: a.id }) || 0;
      const bSold = lookupSoldCount(soldLookup, { handle: b.handle, id: b.id }) || 0;
      return bSold - aSold;
    });
    return sorted;
  }, [products, siteSettings?.colorVariantCards, soldLookup]);

  const pills = useMemo(
    () => [{ handle: "", title: "All" }, ...collections.map((c) => ({ handle: c.handle, title: c.title }))],
    [collections]
  );

  return (
    <section className="border-t border-border/40 py-5 md:py-10">
      <div className="container px-4">
        {/* Pills */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 pb-1 md:flex-wrap">
            {collectionsLoading && pills.length === 1
              ? [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-muted/40" />
                ))
              : pills.map((pill) => {
                  const isActive = active === pill.handle;
                  return (
                    <button
                      key={pill.handle || "all"}
                      type="button"
                      onClick={() => setActive(pill.handle)}
                      className={cn(
                        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 touch-manipulation",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                          : "border border-border/60 bg-card text-foreground/80"
                      )}
                    >
                      {pill.title}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <ProductGridSkeleton
            count={10}
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          />
        ) : displayProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No products in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayProducts.map((p, i) => (
              <UnifiedProductCard
                key={p.id}
                product={p}
                priority={i < 2}
                soldCount={lookupSoldCount(soldLookup, { handle: p.handle, id: p.id })}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

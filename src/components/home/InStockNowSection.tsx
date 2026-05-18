import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { cn } from "@/lib/utils";

const PILLS: { label: string; slug: string }[] = [
  { label: "All", slug: "" },
  { label: "Beanies & Tams", slug: "beanies-tams" },
  { label: "Hats", slug: "hats" },
  { label: "Footwear", slug: "footwear" },
  { label: "Bags", slug: "bags" },
  { label: "Accessories", slug: "accessories" },
];

export function InStockNowSection() {
  const [active, setActive] = useState<string>("");
  const { products, loading } = useHybridProducts({
    categorySlug: active || undefined,
    limit: 12,
  });
  const { data: siteSettings } = useSiteSettings();

  const displayProducts = useMemo(() => {
    let list = products.filter((p) => p.stockStatus !== "out_of_stock");
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    return sortByStockStatus(list as VariantListingProduct[]).slice(0, 4);
  }, [products, siteSettings?.colorVariantCards]);

  const viewAllLink = active ? `/shop/${active}` : "/shop";

  return (
    <section className="border-t border-border/40 py-6">
      <div className="container px-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-wide text-foreground">IN STOCK NOW</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Top picks, ready to ship</p>
          </div>
          <Link
            to={viewAllLink}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary whitespace-nowrap shrink-0"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Category pills */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 pb-1">
            {PILLS.map((pill) => {
              const isActive = active === pill.slug;
              return (
                <button
                  key={pill.slug || "all"}
                  type="button"
                  onClick={() => setActive(pill.slug)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 touch-manipulation",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "border border-border/60 bg-card text-foreground/80"
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : displayProducts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No products in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayProducts.map((p, i) => (
              <UnifiedProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

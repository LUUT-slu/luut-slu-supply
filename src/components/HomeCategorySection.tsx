import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { shuffleArray } from "@/lib/utils";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { useMemo } from "react";

interface HomeCategorySectionProps {
  slug: string;
  label: string;
  subtitle?: string;
  limit?: number;
}

export function HomeCategorySection({ slug, label, subtitle, limit = 4 }: HomeCategorySectionProps) {
  const { products, loading } = useHybridProducts({ categorySlug: slug, limit });
  const { data: siteSettings } = useSiteSettings();

  const displayProducts = useMemo(() => {
    let list = products;
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    if (siteSettings?.hideSoldOut) {
      list = list.filter(p => p.stockStatus !== 'out_of_stock');
    }
    const sorted = sortByStockStatus(list as VariantListingProduct[]);
    return sorted.slice(0, limit);
  }, [products, siteSettings?.hideSoldOut, siteSettings?.colorVariantCards, limit]);

  // Hide section if loading or empty (also hides when Shopify collection unavailable)
  if (loading || displayProducts.length === 0) return null;

  return (
    <section className="border-t border-border/50 py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{label}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="font-body text-sm shrink-0">
            <Link to={`/shop/${slug}`}>
              View All
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 rounded-sm">
          {displayProducts.map((product, idx) => (
            <UnifiedProductCard key={product.id} product={product} priority={idx < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}

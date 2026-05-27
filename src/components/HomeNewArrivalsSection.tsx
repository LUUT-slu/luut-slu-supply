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

interface HomeNewArrivalsSectionProps {
  label: string;
  limit?: number;
}

export function HomeNewArrivalsSection({ label, limit = 4 }: HomeNewArrivalsSectionProps) {
  // Fetch all products — we'll sort client-side since useHybridProducts doesn't support sortBy
  const { products, loading } = useHybridProducts({ limit: limit * 2 });
  const { data: siteSettings } = useSiteSettings();

  const displayProducts = useMemo(() => {
    let list = [...products];
    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(list, siteSettings.colorVariantCards.showOnlyInStock);
    }
    if (siteSettings?.hideSoldOut) {
      list = list.filter(p => p.stockStatus !== 'out_of_stock');
    }
    // Push sold-out items to the end (stable), then take first N as "newest"
    const sorted = sortByStockStatus(list as VariantListingProduct[]);
    return sorted.slice(0, limit);
  }, [products, siteSettings?.hideSoldOut, siteSettings?.colorVariantCards, limit]);

  if (loading || displayProducts.length === 0) return null;

  return (
    <section className="border-t border-border/50 py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{label}</h2>
          <Button asChild variant="ghost" size="sm" className="font-body text-sm">
            <Link to="/shop/new-arrivals">
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

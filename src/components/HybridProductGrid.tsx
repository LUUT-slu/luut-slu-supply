import { useHybridProducts } from "@/hooks/useHybridProducts";
import { UnifiedProductCard } from "./UnifiedProductCard";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useProductSalesCounts, lookupSoldCount } from "@/hooks/useProductSalesCounts";
import { splitByVisualOptions, VariantListingProduct } from "@/lib/variantSplitter";
import { sortByStockStatus } from "@/lib/stockSort";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

interface HybridProductGridProps {
  categorySlug?: string;
  shopifyQuery?: string;
  limit?: number;
  title?: string;
  /** When true, renders nothing instead of "No products found" for empty results */
  hideWhenEmpty?: boolean;
  /** Called after products resolve so parent can know if content exists */
  onEmpty?: () => void;
}

export function HybridProductGrid({ categorySlug, shopifyQuery, limit = 20, title, hideWhenEmpty }: HybridProductGridProps) {
  const { products, loading, error } = useHybridProducts({
    categorySlug: categorySlug === 'all' ? undefined : categorySlug,
    shopifyQuery,
    limit
  });
  const { data: siteSettings } = useSiteSettings();
  const { data: soldLookup } = useProductSalesCounts();

  const displayProducts = useMemo(() => {
    let list = products;

    if (siteSettings?.colorVariantCards?.enabled) {
      list = splitByVisualOptions(
        list,
        siteSettings.colorVariantCards.showOnlyInStock
      );
    }

    if (siteSettings?.hideSoldOut) {
      list = list.filter(p => p.stockStatus !== 'out_of_stock');
    }

    // Always push sold-out items to the end (stable) so they never appear between in-stock items.
    return sortByStockStatus(list as VariantListingProduct[]);
  }, [products, siteSettings?.hideSoldOut, siteSettings?.colorVariantCards]);

  if (loading) {
    if (hideWhenEmpty) return null; // Don't show spinner for homepage category rows
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    if (hideWhenEmpty) return null;
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (displayProducts.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <p className="mb-2 font-body text-lg text-muted-foreground">No products found</p>
        <p className="text-sm text-muted-foreground">Check back soon for new arrivals!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="font-display text-2xl md:text-3xl">{title}</h2>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 rounded-sm">
        {displayProducts.map((product) => (
          <UnifiedProductCard
            key={product.id}
            product={product}
            soldCount={lookupSoldCount(soldLookup, { handle: product.handle, id: product.id })}
          />
        ))}
      </div>
    </div>
  );
}

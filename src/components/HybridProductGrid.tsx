import { UnifiedProduct } from "@/lib/products";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { UnifiedProductCard } from "./UnifiedProductCard";
import { Loader2 } from "lucide-react";

interface HybridProductGridProps {
  categorySlug?: string;  // URL slug like "beanies-tams"
  shopifyQuery?: string;
  limit?: number;
  title?: string;
}

export function HybridProductGrid({ categorySlug, shopifyQuery, limit = 20, title }: HybridProductGridProps) {
  const { products, loading, error } = useHybridProducts({
    categorySlug: categorySlug === 'all' ? undefined : categorySlug,
    shopifyQuery,
    limit,
  });

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <p className="mb-2 font-body text-lg text-muted-foreground">
          No products found
        </p>
        <p className="text-sm text-muted-foreground">
          Check back soon for new arrivals!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <UnifiedProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

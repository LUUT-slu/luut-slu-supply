import { useEffect, useRef } from "react";
import { useBestSellersUnified } from "@/hooks/useBestSellersUnified";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { TrendingUp } from "lucide-react";

interface BestSellersSectionProps {
  limit?: number;
}

export function BestSellersSection({ limit = 8 }: BestSellersSectionProps) {
  const { products, isLoading, source } = useBestSellersUnified(limit);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!loggedRef.current && source !== 'none') {
      console.info(`[best-sellers] source=${source}`);
      loggedRef.current = true;
    }
  }, [source]);

  if (isLoading) {
    return (
      <section className="border-t border-border py-12 md:py-16">
        <div className="container">
          <h2 className="mb-8 text-center font-display text-2xl md:text-3xl">
            BEST SELLERS THIS WEEK
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-lg" />
                <div className="mt-3 h-4 bg-muted rounded w-3/4" />
                <div className="mt-2 h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border py-12 md:py-16">
      <div className="container">
        <div className="mb-8 flex items-center justify-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-center font-display text-2xl md:text-3xl">
            BEST SELLERS THIS WEEK
          </h2>
        </div>

        <div className="relative grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <div key={product.id} className="relative">
              {index < 3 && (
                <div className="pointer-events-none absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground shadow-md">
                  #{index + 1}
                </div>
              )}
              <UnifiedProductCard product={product} priority={index < 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

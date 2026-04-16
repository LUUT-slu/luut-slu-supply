import { Link } from "react-router-dom";
import { useBestSellers } from "@/hooks/useBestSellers";
import { getOptimizedImageUrl } from "@/lib/shopify";
import { TrendingUp } from "lucide-react";

export function BestSellersSection() {
  const { data: bestSellers, isLoading } = useBestSellers();

  if (isLoading) {
    return (
      <section className="bg-card border-t border-border py-10 md:py-14">
        <div className="container">
          <h2 className="mb-6 text-lg font-bold tracking-tight text-foreground uppercase md:text-xl">
            Best Sellers This Week
          </h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border bg-background p-3">
                <div className="aspect-square bg-muted rounded-md" />
                <div className="mt-3 h-4 bg-muted rounded w-3/4" />
                <div className="mt-2 h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!bestSellers || bestSellers.length === 0) {
    return null;
  }

  return (
    <section className="bg-card border-t border-border py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-bold tracking-tight text-foreground uppercase md:text-xl">
            Best Sellers This Week
          </h2>
        </div>
        
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {bestSellers.map((product, index) => (
            <Link
              key={product.product_id}
              to={`/product/${product.product_handle}`}
              className="group relative rounded-lg border border-border bg-background overflow-hidden transition-all duration-200 hover:shadow-[var(--shadow-elevated)]"
            >
              {index < 3 && (
                <div className="absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded bg-foreground font-display text-[10px] font-bold text-white">
                  {index + 1}
                </div>
              )}
              
              <div className="aspect-square overflow-hidden bg-muted">
                {product.product_image_url ? (
                  <img
                    src={getOptimizedImageUrl(product.product_image_url, 500)}
                    alt={product.product_title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-muted-foreground text-sm">No image</span>
                  </div>
                )}
              </div>
              
              <div className="p-3">
                <h3 className="font-body text-sm font-medium line-clamp-2 text-foreground">
                  {product.product_title}
                </h3>
                <p className="mt-1 font-display text-sm font-bold text-foreground">
                  {product.currency_code} {Number(product.price).toFixed(2)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

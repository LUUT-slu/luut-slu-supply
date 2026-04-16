import { Link } from "react-router-dom";
import { useBestSellers } from "@/hooks/useBestSellers";
import { getOptimizedImageUrl } from "@/lib/shopify";
import { TrendingUp } from "lucide-react";

export function BestSellersSection() {
  const { data: bestSellers, isLoading } = useBestSellers();

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

  if (!bestSellers || bestSellers.length === 0) {
    return null; // Don't show section if no best sellers yet
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
        
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {bestSellers.map((product, index) => (
            <Link
              key={product.product_id}
              to={`/product/${product.product_handle}`}
              className="group relative rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              {index < 3 && (
                <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">
                  #{index + 1}
                </div>
              )}
              
              <div className="aspect-square overflow-hidden rounded-md bg-muted">
                {product.product_image_url ? (
                  <img
                    src={getOptimizedImageUrl(product.product_image_url, 500)}
                    alt={product.product_title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
              
                <div className="mt-3">
                  <h3 className="font-display text-sm line-clamp-2">
                    {product.product_title}
                  </h3>
                  <p className="font-body text-sm text-primary">
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

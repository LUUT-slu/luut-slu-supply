import { Link } from "react-router-dom";
import { UnifiedProduct } from "@/lib/products";
import { getOptimizedImageUrl, getImageSrcSet } from "@/lib/shopify";

interface BestSellerCardProps {
  product: UnifiedProduct;
  rank: number;
  /** Number of units sold, when available (local source). */
  totalSold?: number;
  priority?: boolean;
}

/**
 * Mobile-optimized Best Sellers card.
 * Shows: ranking badge, product image, item name, amount sold.
 * Nothing else — minimal and easy to scan.
 */
export function BestSellerCard({ product, rank, totalSold, priority = false }: BestSellerCardProps) {
  const rawImageUrl = product.images[0]?.url;
  const imageUrl = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, 400) : undefined;
  const imageSrcSet = rawImageUrl ? getImageSrcSet(rawImageUrl, 400) : undefined;

  const productLink =
    product.source === "shopify"
      ? `/product/${product.handle}`
      : `/product/local/${product.id}`;

  const isOutOfStock = product.stockStatus === "out_of_stock";

  const soldLabel =
    typeof totalSold === "number" && totalSold > 0
      ? `${totalSold.toLocaleString()} sold`
      : `#${rank} best seller`;

  return (
    <Link
      to={productLink}
      className="group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/50 transition-all touch-manipulation"
    >
      {/* Rank badge */}
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 font-display text-xs text-primary-foreground shadow-md">
        #{rank}
      </div>

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            srcSet={imageSrcSet}
            sizes="(max-width: 640px) 50vw, 25vw"
            alt={product.title}
            className="h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width={400}
            height={400}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-[10px] text-muted-foreground">No image</span>
          </div>
        )}
        {isOutOfStock && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            Sold Out
          </span>
        )}
      </div>

      {/* Minimal content: name + sold */}
      <div className="flex flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 font-body text-sm font-medium leading-tight">
          {product.title}
        </h3>
        <p className="font-display text-xs uppercase tracking-wide text-primary">
          {soldLabel}
        </p>
      </div>
    </Link>
  );
}

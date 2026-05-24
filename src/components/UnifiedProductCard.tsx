import { Link, useNavigate } from "react-router-dom";
import { UnifiedProduct } from "@/lib/products";
import { VariantListingProduct } from "@/lib/variantSplitter";
import { getOptimizedImageUrl, getImageSrcSet } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "./ui/button";
import { ShoppingCart, MapPin, Wallet, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { useResolvedPrice } from "@/hooks/useActivePromotions";
import { PriceTag, SaleRibbon } from "./PriceTag";

interface UnifiedProductCardProps {
  product: UnifiedProduct | VariantListingProduct;
  /** Marks this card as above-the-fold so the image loads eagerly with high priority. */
  priority?: boolean;
  /** Optional sold-count to display on the card (e.g. "12 sold"). */
  soldCount?: number;
}

function formatSold(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k sold`;
  return `${n} sold`;
}

function isVariantListing(p: UnifiedProduct | VariantListingProduct): p is VariantListingProduct {
  return 'visualOptionValue' in p && !!p.visualOptionValue;
}

function StockBadge({ status }: { status: UnifiedProduct['stockStatus'] }) {
  if (status === 'low_stock') {
    return (
      <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Low Stock
      </span>
    );
  }
  if (status === 'out_of_stock') {
    return (
      <span className="absolute right-2 top-2 z-10 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Out of Stock
      </span>
    );
  }
  return null;
}

export function UnifiedProductCard({ product, priority = false, soldCount }: UnifiedProductCardProps) {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const isMobile = useIsMobile();
  const { trackEvent } = useAnalyticsTracker();

  const handleCardClick = () => {
    trackEvent({
      eventType: "product_clicked",
      productId: product.id,
      productName: product.title,
      productCategory: product.category || undefined,
      sellerId: product.vendor || undefined,
    });
  };
  
  const isVariant = isVariantListing(product);
  const firstVariant = product.variants[0];
  const price = parseFloat(product.price.amount);
  const resolved = useResolvedPrice({
    id: product.id,
    price,
    collectionHandles: (product as UnifiedProduct).collectionHandles,
    category: product.category,
    vendor: product.vendor,
  });
  const rawImageUrl = product.images[0]?.url;
  // Mobile 2-col card image ~ half viewport (≈220-260px logical, request 2x for retina)
  const baseWidth = isMobile ? 520 : 600;
  const imageUrl = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, baseWidth) : undefined;
  const imageSrcSet = rawImageUrl ? getImageSrcSet(rawImageUrl, baseWidth) : undefined;
  const imageSizes = isMobile
    ? "50vw"
    : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
  const isOutOfStock = product.stockStatus === 'out_of_stock';
  
  // Build product link — for variant cards, deep-link with variant pre-selection
  let productLink: string;
  if (product.source === 'shopify') {
    // Strip the variant split suffix from id to get the original handle
    const handle = product.handle;
    productLink = `/product/${handle}`;
    if (isVariant && product.preselectedVariantId) {
      productLink += `?variant=${encodeURIComponent(product.preselectedVariantId)}`;
    }
  } else {
    productLink = `/product/local/${product.id}`;
  }

  // Display title: append visual option value for variant cards
  const displayTitle = isVariant
    ? `${product.title} — ${product.visualOptionValue}`
    : product.title;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant || !firstVariant.availableForSale || isOutOfStock) {
      toast.error("This product is currently unavailable");
      return;
    }

    if (product.source === 'lovable' && product.originalLovableProduct) {
      const result = addItem({
        product: {
          node: {
            id: product.id,
            title: product.title,
            description: product.description,
            handle: product.handle,
            vendor: product.vendor,
            productType: product.category || '',
            tags: [],
            createdAt: product.originalLovableProduct.created_at,
            priceRange: {
              minVariantPrice: product.price,
            },
            images: {
              edges: product.images.map(img => ({
                node: { url: img.url, altText: img.altText },
              })),
            },
            variants: {
              edges: product.variants.map(v => ({
                node: {
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  availableForSale: v.availableForSale,
                  selectedOptions: v.selectedOptions,
                },
              })),
            },
            options: [],
          },
        },
        variantId: firstVariant.id,
        variantTitle: firstVariant.title,
        price: firstVariant.price,
        quantity: 1,
        selectedOptions: firstVariant.selectedOptions,
      });

      if (result.success) {
        navigate('/cart');
      } else {
        toast.error(result.error || "Failed to add to cart");
      }
    } else if (product.source === 'shopify' && product.originalShopifyProduct) {
      const result = addItem({
        product: product.originalShopifyProduct,
        variantId: firstVariant.id,
        variantTitle: firstVariant.title,
        price: firstVariant.price,
        quantity: 1,
        selectedOptions: firstVariant.selectedOptions,
      });

      if (result.success) {
        navigate('/cart');
      } else {
        toast.error(result.error || "Failed to add to cart");
      }
    }
  };

  // Mobile: vertical 2-column card (image on top)
  if (isMobile) {
    const qty = (product as UnifiedProduct).quantity;
    const showLeftBadge = typeof qty === "number" && qty > 0 && qty < 5;

    return (
      <Link
        to={productLink}
        onClick={handleCardClick}
        className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/50 touch-manipulation"
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet}
              sizes={imageSizes}
              alt={displayTitle}
              className="h-full w-full object-cover"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}

          {/* Wishlist icon top-right */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            aria-label="Save to wishlist"
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm ring-1 ring-border/40"
          >
            <Heart className="h-4 w-4 text-foreground" />
          </button>

          {/* Out of stock badge (top-left) */}
          {isOutOfStock && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              Sold Out
            </span>
          )}

          {/* "X left" badge bottom-right when low stock and qty known */}
          {showLeftBadge && (
            <span className="absolute right-2 bottom-2 z-10 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
              {qty} left
            </span>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 truncate">
            {product.vendor}
          </p>
          <h3 className="font-body text-[13px] font-semibold leading-snug line-clamp-2 text-foreground">
            {displayTitle}
          </h3>

          {(isVariant && product.visualOptionValue) || (!isVariant && product.category) ? (
            <span className="mt-0.5 inline-block self-start rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {isVariant ? product.visualOptionValue : product.category}
            </span>
          ) : null}

          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[15px] font-semibold text-primary">
              EC${price.toFixed(2)}
            </span>
          </div>

          {typeof soldCount === "number" && soldCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span>{formatSold(soldCount)}</span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Desktop: vertical card
  return (
    <Link
      to={productLink}
      onClick={handleCardClick}
      className="group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/50 transition-all duration-300 hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            srcSet={imageSrcSet}
            sizes={imageSizes}
            alt={displayTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width={600}
            height={600}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
        
        <StockBadge status={product.stockStatus} />
        
        {product.source === 'lovable' && (
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Local Seller
            </span>
          </div>
        )}

        {!isOutOfStock && firstVariant?.availableForSale && (
          <div className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 rounded-full p-0"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">{product.vendor}</p>
          {typeof soldCount === 'number' && soldCount > 0 && (
            <span className="text-[11px] font-medium text-primary whitespace-nowrap">
              {formatSold(soldCount)}
            </span>
          )}
        </div>
        <h3 className="mb-1 line-clamp-2 font-body text-sm font-medium leading-tight">
          {displayTitle}
        </h3>
        {isVariant && product.visualOptionValue && (
          <span className="mb-2 inline-block self-start rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {product.visualOptionValue}
          </span>
        )}
        <div className="mt-auto flex items-center justify-between">
          <span className="font-display text-lg">
            EC${price.toFixed(2)}
          </span>
          {isOutOfStock && (
            <Button size="sm" disabled variant="outline" className="text-xs">
              Sold Out
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}

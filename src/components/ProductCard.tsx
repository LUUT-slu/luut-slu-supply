import { Link } from "react-router-dom";
import { ShoppingBag, Shield, MapPin, Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { ShopifyProduct, getOptimizedImageUrl, getImageSrcSet, normalizeVendorName } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { useResolvedPrice } from "@/hooks/useActivePromotions";
import { PriceTag, SaleRibbon } from "./PriceTag";

interface ProductCardProps {
  product: ShopifyProduct;
  /** Above-the-fold cards load eagerly with high fetch priority. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const setOpen = useCartStore((state) => state.setOpen);
  const { trackEvent } = useAnalyticsTracker();
  const { node } = product;

  const firstVariant = node.variants.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;
  const priceNum = parseFloat(price.amount);
  const resolved = useResolvedPrice({
    id: node.id,
    price: priceNum,
    collectionHandles: (node as any).collectionHandles,
    category: node.productType,
    vendor: node.vendor,
  });
  const rawImage = node.images.edges[0]?.node;
  const image = rawImage ? { ...rawImage, url: getOptimizedImageUrl(rawImage.url, 600) } : undefined;
  const imageSrcSet = rawImage ? getImageSrcSet(rawImage.url, 600) : undefined;
  const vendor = normalizeVendorName(node.vendor || "Luut SLU");

  // Check if certified seller
  const isCertified = vendor.includes("Certified") || node.tags?.includes("certified-seller");

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant) return;

    const result = addItem({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: resolved.hasDiscount
        ? { amount: resolved.final.toFixed(2), currencyCode: firstVariant.price.currencyCode }
        : firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions,
    });

    if (result.success) {
      toast.success("Added to cart", {
        description: node.title,
        position: "top-center",
      });
    } else {
      toast.error("Cannot add to cart", {
        description: result.error,
        position: "top-center",
        duration: 5000,
      });
    }
  };

  return (
    <Link
      to={`/product/${node.handle}`}
      onClick={() => trackEvent({ eventType: "product_clicked", productId: node.id, productName: node.title, productCategory: node.productType || undefined, sellerId: node.vendor || undefined })}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg touch-manipulation"
    >
      {/* Image with trust badge overlay */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
          <img
            src={image.url}
            srcSet={imageSrcSet}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            alt={image.altText || node.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width={600}
            height={600}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Verified badge - top right */}
        {isCertified && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2 py-1 text-[10px] text-primary border border-primary/20">
            <Shield className="h-3 w-3" />
            <span className="font-medium">Verified</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="mb-1 font-body text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
          {node.title}
        </h3>
        
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-lg text-primary">
            <PriceTag resolved={resolved} size="md" showPercentChip />
            {/* placeholder kept for legacy layout: */}
            <span className="sr-only">EC${resolved.final.toFixed(2)}</span>
          </span>
          <Button
            size="sm"
            onClick={handleAddToCart}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Trust indicators row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mb-2">
          <span className="flex items-center gap-1">
            <Wallet className="h-3 w-3 text-primary/60" />
            Pay on Meetup
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary/60" />
            Local
          </span>
        </div>
        
        {/* Seller info */}
        <p className="text-[11px] text-muted-foreground/60">
          Sold by{" "}
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/seller/${encodeURIComponent(vendor.toLowerCase().replace(/\s+/g, '-'))}`;
            }}
            className="text-muted-foreground/80 hover:text-primary cursor-pointer transition-colors"
          >
            {vendor}
          </span>
        </p>
      </div>
    </Link>
  );
}

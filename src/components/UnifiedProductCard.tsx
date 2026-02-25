import { Link, useNavigate } from "react-router-dom";
import { UnifiedProduct } from "@/lib/products";
import { getOptimizedImageUrl } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "./ui/button";
import { ShoppingCart, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface UnifiedProductCardProps {
  product: UnifiedProduct;
}

export function UnifiedProductCard({ product }: UnifiedProductCardProps) {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const isMobile = useIsMobile();
  
  const firstVariant = product.variants[0];
  const price = parseFloat(product.price.amount);
  const rawImageUrl = product.images[0]?.url;
  const imageUrl = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, 600) : undefined;
  
  const productLink = product.source === 'shopify' 
    ? `/product/${product.handle}` 
    : `/product/local/${product.id}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant || !firstVariant.availableForSale) {
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

  // Mobile: horizontal card layout
  if (isMobile) {
    return (
      <Link
        to={productLink}
        className="group flex gap-3 overflow-hidden rounded-lg bg-card ring-1 ring-border/50 p-2 transition-all touch-manipulation"
      >
        {/* Square image thumbnail */}
        <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-[10px] text-muted-foreground">No image</span>
            </div>
          )}
          {product.source === 'lovable' && (
            <div className="absolute left-1 top-1">
              <span className="rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
                Local
              </span>
            </div>
          )}
        </div>

        {/* Details - stacked vertically */}
        <div className="flex flex-1 flex-col justify-between min-w-0 py-0.5">
          <div>
            <p className="text-[10px] text-muted-foreground truncate">{product.vendor}</p>
            <h3 className="font-body text-sm font-medium leading-tight line-clamp-2 mt-0.5">
              {product.title}
            </h3>
            {product.category && (
              <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {product.category}
              </span>
            )}
          </div>

          <div className="mt-auto space-y-1">
            {/* Trust indicators */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-0.5">
                <Wallet className="h-2.5 w-2.5 text-primary/60" />
                Pay on Meetup
              </span>
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5 text-primary/60" />
                Local
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-display text-base text-primary">
                EC${price.toFixed(2)}
              </span>
              {!firstVariant?.availableForSale ? (
                <span className="text-[10px] text-destructive">Out of Stock</span>
              ) : (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Desktop: original vertical card
  return (
    <Link
      to={productLink}
      className="group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/50 transition-all duration-300 hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
        
        {product.source === 'lovable' && (
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Local Seller
            </span>
          </div>
        )}

        {firstVariant?.availableForSale && (
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
        <p className="mb-1 text-xs text-muted-foreground">{product.vendor}</p>
        <h3 className="mb-2 line-clamp-2 font-body text-sm font-medium leading-tight">
          {product.title}
        </h3>
        <div className="mt-auto flex items-center justify-between">
          <span className="font-display text-lg">
            EC${price.toFixed(2)}
          </span>
          {!firstVariant?.availableForSale && (
            <span className="text-xs text-destructive">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}

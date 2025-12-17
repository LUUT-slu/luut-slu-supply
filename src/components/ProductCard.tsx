import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import { ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";

interface ProductCardProps {
  product: ShopifyProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const setOpen = useCartStore((state) => state.setOpen);
  const { node } = product;

  const firstVariant = node.variants.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;
  const image = node.images.edges[0]?.node;
  const vendor = node.vendor || "Luut SLU";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstVariant) return;

    addItem({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions,
    });

    toast.success("Added to cart", {
      description: node.title,
      position: "top-center",
    });
  };

  return (
    <Link
      to={`/product/${node.handle}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {image ? (
          <img
            src={image.url}
            alt={image.altText || node.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="mb-1 text-xs text-muted-foreground">
          Sold by: <span className="text-foreground">{vendor}</span>
        </p>
        <h3 className="mb-2 font-body text-sm font-medium line-clamp-2 group-hover:text-primary">
          {node.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-display text-lg text-primary">
            ${parseFloat(price.amount).toFixed(2)} {price.currencyCode}
          </span>
          <Button
            size="sm"
            onClick={handleAddToCart}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
